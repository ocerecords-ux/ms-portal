import { prisma } from '@/lib/db';
import { posledniStrany, prvniStrany } from '@/lib/brunoServer';
import { pocetStranTextu } from '@/lib/textProjektuServer';
import {
  progresProjektu,
  progresZeStran,
  rozdelStrany,
  type ProgresNataceni,
} from '@/lib/progresNataceni';

/**
 * PROGRES NATÁČENÍ PRO VÍC PROJEKTŮ NAJEDNOU (zadání 19. 9. 2026: „měl by
 * ho vidět i klient a hlavně my v detailu projektu").
 *
 * Tři dotazy pro celou stránku: poslední strany (Bruno), kdo má dotočeno
 * a počet stran PDF (s mezipamětí, viz textProjektuServer).
 *
 * Strana u herce: jeho vlastní zápis; když ho nemá, zápis bez herce
 * (projekt s jediným hercem, kde Bruno herce neurčil).
 */
export type ProgresProjektu = {
  celkem: ProgresNataceni;
  herci: Record<string, ProgresNataceni>;
  stranTextu: number | null;
  /**
   * Odkud se vzal celek, proti kterému se počítá (29. 9. 2026: „strany tam už
   * jsou. Já tam ale chci progres!!! procentama").
   *
   * 'pdf'  - počet stran režijního editu ve složce projektu, to je přesné,
   * 'ns'   - normostrany zapsané u projektu (u herce jeho vlastní). Není to
   *          totéž co strany PDF, ale je to rozsah téhož textu, takže
   *          procento sedí dost na to, aby klient viděl, jak daleko jsme.
   *          Radši přibližné procento než prázdná buňka.
   * null   - nemáme ani jedno.
   */
  zdrojCelku: 'pdf' | 'ns' | null;
};

type RozsahProjektu = { caflouProjectId: string; pageCount: number | null };
type RozsahHerce = { caflouProjectId: string; userId: string; pageCount: number; createdAt: Date };

export async function nactiProgresNataceni(
  projekty: { id: string; herciIds: string[] }[],
): Promise<Map<string, ProgresProjektu>> {
  const vysledek = new Map<string, ProgresProjektu>();
  if (projekty.length === 0) return vysledek;
  const ids = projekty.map((p) => p.id);

  const [strany, prvni, dotoceno, stran, normostrany, normostranyHercu] = await Promise.all([
    posledniStrany(ids),
    // Kdo čte začátek knihy a kdo druhou půlku (30. 9. 2026) - viz `rozdelStrany`.
    prvniStrany(ids).catch(() => new Map<string, number>()),
    prisma.herecDotocen
      .findMany({ where: { caflouProjectId: { in: ids } }, select: { caflouProjectId: true, userId: true } })
      .catch(() => [] as { caflouProjectId: string; userId: string }[]),
    pocetStranTextu(ids),
    /**
     * NORMOSTRANY JAKO NÁHRADNÍ CELEK. PDF s textem ve složce být nemusí
     * (a u půlky projektů není), rozsah v normostranách ale zadáváme vždycky -
     * bez něj by nešlo ani fakturovat. Tím se z „str. 141" stane 42 %.
     */
    (prisma.projectMeta.findMany({
      where: { caflouProjectId: { in: ids } },
      select: { caflouProjectId: true, pageCount: true },
    }) as Promise<RozsahProjektu[]>).catch((): RozsahProjektu[] => []),
    // U víc herců čte každý svůj díl - pak platí jeho vlastní rozsah.
    (prisma.herecNormostrany.findMany({
      where: { caflouProjectId: { in: ids } },
      orderBy: { createdAt: 'asc' },
      select: { caflouProjectId: true, userId: true, pageCount: true, createdAt: true },
    }) as Promise<RozsahHerce[]>).catch((): RozsahHerce[] => []),
  ]);
  const dotocene = new Set(dotoceno.map((d) => `${d.caflouProjectId}:${d.userId}`));
  const ns = new Map(normostrany.map((m) => [m.caflouProjectId, m.pageCount ?? null]));
  const nsHerce = new Map(normostranyHercu.map((m) => [`${m.caflouProjectId}:${m.userId}`, m.pageCount]));
  /** Pořadí, ve kterém se rozsahy zapsaly - záloha, když ještě nikdo netočil. */
  const poradiNs = new Map(
    normostranyHercu.map((m, i) => [`${m.caflouProjectId}:${m.userId}`, i]),
  );

  for (const p of projekty) {
    const zPdf = stran.get(p.id) ?? null;
    const zNs = ns.get(p.id) ?? null;
    const celkemStran = zPdf ?? zNs;
    const zdrojCelku = zPdf ? ('pdf' as const) : zNs ? ('ns' as const) : null;

    /**
     * DÍLY HERCŮ (zadání 30. 9. 2026). Herci se seřadí podle toho, kdo čte
     * dřívější strany - podle nejnižšího zápisu zvukaře, a kde ještě nikdo
     * netočil, podle pořadí, ve kterém se rozsahy zapsaly. Pak se jejich
     * normostrany přepočítají na strany PDF.
     *
     * `rozdelStrany` vrátí prázdno, kdykoliv dělit nelze (jeden herec, chybí
     * rozsah, není počet stran) - tam se počítá po staru proti celému textu.
     */
    const serazeni = [...p.herciIds].sort((a, b) => {
      const pa = prvni.get(`${p.id}:${a}`);
      const pb = prvni.get(`${p.id}:${b}`);
      if (pa != null && pb != null && pa !== pb) return pa - pb;
      if (pa != null && pb == null) return -1;
      if (pa == null && pb != null) return 1;
      return (poradiNs.get(`${p.id}:${a}`) ?? 0) - (poradiNs.get(`${p.id}:${b}`) ?? 0);
    });
    const dily = rozdelStrany(
      serazeni.map((h) => ({ klic: h, normostrany: nsHerce.get(`${p.id}:${h}`) ?? 0 })),
      zPdf ?? zNs,
    );

    const herci: Record<string, ProgresNataceni> = {};
    for (const h of p.herciIds) {
      const strana = strany.get(`${p.id}:${h}`) ?? strany.get(`${p.id}:`) ?? null;
      // Vlastní rozsah herce má přednost jen tam, kde se celek bere z NS -
      // strany PDF jsou pro celý dokument, ne pro jeho díl.
      const celekHerce = zPdf ?? nsHerce.get(`${p.id}:${h}`) ?? zNs;
      herci[h] = progresZeStran(strana, celekHerce, dotocene.has(`${p.id}:${h}`), dily[h] ?? null);
    }
    const celkem =
      p.herciIds.length > 0
        ? progresProjektu(p.herciIds.map((h) => herci[h]))
        : progresZeStran(strany.get(`${p.id}:`) ?? null, celkemStran, false);
    vysledek.set(p.id, { celkem, herci, stranTextu: celkemStran, zdrojCelku });
  }
  return vysledek;
}
