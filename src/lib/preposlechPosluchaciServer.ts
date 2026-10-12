import { prisma } from '@/lib/db';
import { sendNoveStopyEmail } from '@/lib/email';
import { nactiZDisku } from '@/lib/preposlechDriveServer';
import { urlPreposlechu } from '@/lib/preposlechOdkaz';
import { stavJeOdevzdany } from '@/lib/stavyProjektu';

/**
 * POSLUCHAČI ODKAZU DO AUDIOTAGGERU (zadání 21. 9. 2026: „aby vyskočilo po
 * kliknutí na odkaz AudioTaggeru okno, kde se zadá mail, kvůli identifikaci.
 * Primárně asi mail, na který se to pošle + když chci někomu delegovat
 * přeposlech. Ale asi by se to mělo objevit jen na začátku u projektů, které
 * posíláme poprvé. Jakmile se to uloží, tak by to už nevyskakovalo, ale dalo
 * se to někde editovat na panelu. Těm lidem pak nastavíme podle mailu
 * i notifikace, že tam přibyly nové tracky").
 *
 * A téhož dne: „aby tam byl záznam o tom, kdo co udělal" - každé přidání,
 * odebrání a odeslaná zpráva jde do historie přeposlechu, a poznámky se od
 * teď podepisují jménem toho, kdo se představil (viz preposlechPristup).
 */

export type PosluchacVSeznamu = {
  id: string;
  email: string;
  jmeno: string | null;
  notifikace: boolean;
  pridal: string | null;
  createdAt: string;
};

export async function nactiPosluchace(caflouProjectId: string): Promise<PosluchacVSeznamu[]> {
  const lide = await prisma.preposlechPosluchac
    .findMany({ where: { caflouProjectId }, orderBy: { createdAt: 'asc' } })
    .catch(() => []);
  return lide.map((l) => ({
    id: l.id,
    email: l.email,
    jmeno: l.jmeno,
    notifikace: l.notifikace,
    pridal: l.pridal,
    createdAt: l.createdAt.toISOString(),
  }));
}

/** Zápis do historie přeposlechu. Nikdy nevyhazuje. */
export async function zapisDoHistorie(caflouProjectId: string, typ: string, popis: string, kdo: string | null) {
  await prisma.preposlechUdalost
    .create({ data: { caflouProjectId, typ, popis, kdo } })
    .catch((err) => console.error('Zápis do historie přeposlechu selhal:', err));
}

/**
 * ZPRÁVA O NOVÝCH STOPÁCH. Volá se, kdykoli portál zjistí, kolik stop je na
 * Disku - při otevření AudioTaggeru i z hodinové kontroly (cron nove-stopy).
 *
 * `oznamenoStop` drží, o kolika stopách už posluchači vědí. Kdo se přidá
 * později, nedostane zprávu o stopách, které tam byly už předtím - první
 * zjištění jen nastaví výchozí počet.
 *
 * Po PŘEPOSLECHNUTO už se nic neposílá. Nikdy nevyhazuje.
 */
export async function oznamNoveStopy(caflouProjectId: string, celkem: number): Promise<number> {
  try {
    const [stav, odkaz, posluchaci, projekt] = await Promise.all([
      prisma.preposlechStav.findUnique({
        where: { caflouProjectId },
        select: { oznamenoStop: true, reviewed: true },
      }),
      prisma.preposlechOdkaz.findUnique({ where: { caflouProjectId }, select: { token: true, zneplatnenoAt: true } }),
      prisma.preposlechPosluchac.findMany({ where: { caflouProjectId, notifikace: true } }),
      prisma.projectMeta.findUnique({
        where: { caflouProjectId },
        select: { name: true, statusName: true },
      }),
    ]);
    if (!stav || posluchaci.length === 0) return 0;

    /**
     * PO ODEVZDÁNÍ UŽ SE NEOZNAMUJE (zadání 12. 10. 2026: „notifikace o tom,
     * že jsme přidali novou nahrávku do AudioTaggeru, by měla chodit jen do
     * doby, kdy se překlopil projekt na Dokončeno - ke schválení. Protože to
     * je moment, kdy tam jsou už všechny nahrávky na disku a potom už se
     * přidávají už třeba ukázky a ty už se netýkají přeposlechu").
     *
     * Počítadlo se přitom POSUNE: co na disk přibylo po odevzdání, se nemá
     * ohlásit ani později, kdyby se stav na chvíli vrátil zpátky. Jsou to
     * ukázky, ne stopy k přeposlechu.
     */
    if (stavJeOdevzdany(projekt?.statusName)) {
      if (stav.oznamenoStop !== celkem) {
        await prisma.preposlechStav
          .update({ where: { caflouProjectId }, data: { oznamenoStop: celkem } })
          .catch(() => undefined);
      }
      return 0;
    }

    const dosud = stav.oznamenoStop;
    if (dosud === null || dosud === undefined || celkem < dosud) {
      await prisma.preposlechStav.update({ where: { caflouProjectId }, data: { oznamenoStop: celkem } });
      return 0;
    }
    if (celkem === dosud || stav.reviewed || !odkaz || odkaz.zneplatnenoAt) return 0;

    // Zamek: stejne stopy muze naraz zjistit otevreny AudioTagger i hodinova
    // kontrola. Zpravu posle jen ten, komu se podari posunout pocitadlo.
    const posunuto = await prisma.preposlechStav.updateMany({
      where: { caflouProjectId, oznamenoStop: dosud },
      data: { oznamenoStop: celkem },
    });
    if (posunuto.count !== 1) return 0;

    const nazev = projekt?.name || 'Nahrávka';
    const odeslano: string[] = [];
    for (const p of posluchaci) {
      try {
        const r = await sendNoveStopyEmail({
          to: p.email,
          jmeno: p.jmeno,
          nazevProjektu: nazev,
          odkaz: urlPreposlechu(odkaz.token),
          pribylo: celkem - dosud,
          celkem,
        });
        if (r.sent) odeslano.push(p.email);
      } catch (err) {
        console.error(`Zpráva o nových stopách na ${p.email} selhala:`, err);
      }
    }
    if (odeslano.length > 0) {
      await zapisDoHistorie(
        caflouProjectId,
        'NOVE_STOPY',
        `Přibylo ${celkem - dosud} nových stop (celkem ${celkem}) - zpráva odešla na: ${odeslano.join(', ')}.`,
        'Portál',
      );
    }
    return odeslano.length;
  } catch (err) {
    console.error('oznamNoveStopy selhalo:', err);
    return 0;
  }
}

/**
 * Hodinová kontrola (cron nove-stopy): projekty, které mají posluchače se
 * zapnutými zprávami, platný odkaz a ještě nejsou přeposlechnuté. U každého
 * se podívá do složky na Disku. Strop, ať se kontrola vejde do limitu.
 */
export async function zkontrolujNoveStopy(strop = 60): Promise<{ projektu: number; zprav: number }> {
  const skupiny = await prisma.preposlechPosluchac.groupBy({
    by: ['caflouProjectId'],
    where: { notifikace: true },
  });
  const ids: string[] = skupiny.map((s: { caflouProjectId: string }) => s.caflouProjectId);
  if (ids.length === 0) return { projektu: 0, zprav: 0 };

  const [hotove, odkazy, projekty] = await Promise.all([
    prisma.preposlechStav.findMany({ where: { caflouProjectId: { in: ids }, reviewed: true }, select: { caflouProjectId: true } }),
    prisma.preposlechOdkaz.findMany({
      where: { caflouProjectId: { in: ids }, zneplatnenoAt: null },
      select: { caflouProjectId: true },
    }),
    /**
     * Stav projektu (12. 10. 2026) - od „Dokončeno - ke schválení" dál se na disk
     * přidávají ukázky, ne stopy k přeposlechu, takže se takový projekt
     * nekontroluje vůbec. Ušetří to i dotazy na Disk.
     */
    prisma.projectMeta
      .findMany({
        where: { caflouProjectId: { in: ids } },
        select: { caflouProjectId: true, statusName: true },
      })
      .catch(() => [] as { caflouProjectId: string; statusName: string | null }[]),
  ]);
  const hotovo = new Set(hotove.map((h) => h.caflouProjectId));
  const sOdkazem = new Set(odkazy.map((o) => o.caflouProjectId));
  const odevzdane = new Set(
    projekty.filter((p) => stavJeOdevzdany(p.statusName)).map((p) => p.caflouProjectId),
  );
  const kontrolovat = ids
    .filter((id) => !hotovo.has(id) && !odevzdane.has(id) && sOdkazem.has(id))
    .slice(0, strop);

  let zprav = 0;
  for (const id of kontrolovat) {
    const disk = await nactiZDisku(id).catch(() => null);
    if (!disk || !disk.ok) continue;
    await prisma.preposlechStav
      .upsert({
        where: { caflouProjectId: id },
        update: { pocetStop: disk.stopy.length, stopyZjistenyAt: new Date() },
        create: { caflouProjectId: id, pocetStop: disk.stopy.length, stopyZjistenyAt: new Date() },
      })
      .catch(() => undefined);
    zprav += await oznamNoveStopy(id, disk.stopy.length);
  }
  return { projektu: kontrolovat.length, zprav };
}
