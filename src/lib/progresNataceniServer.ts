import { prisma } from '@/lib/db';
import { posledniStrany } from '@/lib/brunoServer';
import { pocetStranTextu } from '@/lib/textProjektuServer';
import {
  koeficientKnihy,
  progresProjektu,
  progresZeStran,
  type KoeficientKnihy,
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
  /**
   * KOEFICIENT PŘEVODU U TÉHLE KNIHY (30. 9. 2026: „u každé knihy spočítat
   * koeficient převodu z pdf na normostrany… každá kniha bude mít jiný,
   * musíme to vždycky přepočítat"). Počítá se při každém zobrazení, nikde
   * se neukládá. Null, když chybí PDF nebo rozsah v normostranách.
   */
  koeficient: KoeficientKnihy | null;
  /** Herci bez vyplněného rozsahu - kvůli nim se díly nepočítají vůbec. */
  bezNormostran: string[];
  /** Součet normostran herců se rozchází s rozsahem knihy. */
  nesoulad: { soucetHercu: number; kniha: number } | null;
};

type RozsahProjektu = { caflouProjectId: string; pageCount: number | null };
type RozsahHerce = { caflouProjectId: string; userId: string; pageCount: number; createdAt: Date };

export async function nactiProgresNataceni(
  projekty: { id: string; herciIds: string[] }[],
): Promise<Map<string, ProgresProjektu>> {
  const vysledek = new Map<string, ProgresProjektu>();
  if (projekty.length === 0) return vysledek;
  const ids = projekty.map((p) => p.id);

  const [strany, dotoceno, stran, normostrany, normostranyHercu] = await Promise.all([
    posledniStrany(ids),
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
    // Rozsah každého herce za celou knihu - váha do součtu projektu a číslo,
    // ze kterého se plánují frekvence (1. 10. 2026).
    (prisma.herecNormostrany.findMany({
      where: { caflouProjectId: { in: ids } },
      orderBy: { createdAt: 'asc' },
      select: { caflouProjectId: true, userId: true, pageCount: true, createdAt: true },
    }) as Promise<RozsahHerce[]>).catch((): RozsahHerce[] => []),
  ]);
  const dotocene = new Set(dotoceno.map((d) => `${d.caflouProjectId}:${d.userId}`));
  const ns = new Map(normostrany.map((m) => [m.caflouProjectId, m.pageCount ?? null]));
  const nsHerce = new Map(normostranyHercu.map((m) => [`${m.caflouProjectId}:${m.userId}`, m.pageCount]));

  for (const p of projekty) {
    const zPdf = stran.get(p.id) ?? null;
    const zNs = ns.get(p.id) ?? null;
    const celkemStran = zPdf ?? zNs;
    const zdrojCelku = zPdf ? ('pdf' as const) : zNs ? ('ns' as const) : null;

    /**
     * NORMOSTRANY HERCE JSOU VÁHA, NE POZICE (upřesněno 1. 10. 2026: „ten
     * počet NS u každého herce je celkový počet NS, které mají za celou
     * knihu natočit, a mají to v různých částech knihy… slouží jen jako
     * poměr a údaj pro to, kolik máme kterému naplánovat frekvencí").
     *
     * Herec čte rozházené kapitoly po celé knize, takže souvislý díl „od
     * strany - do strany" u něj neexistuje a nic takového se nepočítá.
     * Procento je jeho strana proti celému textu, váha do součtu projektu
     * jsou jeho normostrany.
     */
    const bezNormostran =
      p.herciIds.length > 1
        ? p.herciIds.filter((h) => !((nsHerce.get(`${p.id}:${h}`) ?? 0) > 0))
        : [];
    const soucetNsHercu = p.herciIds.reduce((a, h) => a + (nsHerce.get(`${p.id}:${h}`) ?? 0), 0);
    const nesoulad =
      p.herciIds.length > 1 &&
      bezNormostran.length === 0 &&
      zNs &&
      zNs > 0 &&
      Math.abs(soucetNsHercu - zNs) > 1
        ? { soucetHercu: soucetNsHercu, kniha: zNs }
        : null;

    const herci: Record<string, ProgresNataceni> = {};
    for (const h of p.herciIds) {
      const strana = strany.get(`${p.id}:${h}`) ?? strany.get(`${p.id}:`) ?? null;
      herci[h] = progresZeStran(
        strana,
        celkemStran,
        dotocene.has(`${p.id}:${h}`),
        nsHerce.get(`${p.id}:${h}`) ?? null,
      );
    }
    const celkem =
      p.herciIds.length > 0
        ? progresProjektu(p.herciIds.map((h) => herci[h]))
        : progresZeStran(strany.get(`${p.id}:`) ?? null, celkemStran, false);
    vysledek.set(p.id, {
      celkem,
      herci,
      stranTextu: celkemStran,
      zdrojCelku,
      koeficient: koeficientKnihy(zPdf, zNs),
      bezNormostran,
      nesoulad,
    });
  }
  return vysledek;
}
