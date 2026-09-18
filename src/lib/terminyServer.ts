import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { isRodnyListProjectType } from '@/lib/priceList';
import { DNU_PRED_TERMINEM, dnuDoTerminu, dnuSlovy } from '@/lib/terminProjektu';

/**
 * TÝDEN PŘED TERMÍNEM CINKNE ZVONEK (zadání 18. 9. 2026: „když se blíží datum
 * dokončení a zbývá 7 dní do konce projektu, tak přijde Peterovi upozornění
 * zvonečkem - toto se týká jen audioknih, protože je to dlouhodobý projekt").
 *
 * JEN DLOUHODOBÉ PROJEKTY. Reklamní spot se natočí a odevzdá v řádu dnů;
 * upozornění týden dopředu by u něj přišlo dřív, než projekt vůbec vznikne.
 * Reklama se pozná stejně jako všude jinde v portálu - podle toho, že její typ
 * má v ceníku zapnutý Rodný list (viz lib/priceList.ts). Všechno ostatní je
 * dlouhá práce, u které má připomenutí smysl.
 *
 * KOMU: kdo má na kartě zaškrtnuté „Hlídá změny u projektů" - tentýž příznak,
 * který rozhoduje o zvonku při změně stavu a termínu. Dva skoro stejné
 * příznaky vedle sebe by si nikdo nezapamatoval.
 *
 * Ukončené projekty se přeskakují a upozornění chodí JEN jednou: úloha běží
 * jednou denně, ale i kdyby ji někdo pustil ručně podruhé, druhý řádek pod
 * zvonkem nepřibude.
 */

export type VysledekTerminu = {
  upozorneno: { caflouProjectId: string; nazev: string | null }[];
  preskoceno: number;
};

export async function posliUpozorneniNaTerminy(): Promise<VysledekTerminu> {
  const vysledek: VysledekTerminu = { upozorneno: [], preskoceno: 0 };

  const prijemci = await prisma.user.findMany({
    where: { active: true, sledujeZmenyProjektu: true },
    select: { id: true },
  });
  const komu = prijemci.map((u) => u.id);
  if (komu.length === 0) return vysledek;

  /**
   * Bere se okno, ne jediný den. Kdyby úloha jednou neproběhla (výpadek,
   * nasazení), připomenutí by při hledání „přesně sedmý den" propadlo úplně -
   * a tichý výpadek je u hlídání termínů to nejhorší, co může nastat.
   */
  const dnes = new Date();
  const od = new Date(Date.UTC(dnes.getFullYear(), dnes.getMonth(), dnes.getDate()));
  const doKdy = new Date(od);
  doKdy.setUTCDate(doKdy.getUTCDate() + DNU_PRED_TERMINEM);

  const projekty = await prisma.projectMeta.findMany({
    where: { finished: false, endDate: { gte: od, lte: doKdy } },
    select: { caflouProjectId: true, name: true, projectType: true, endDate: true },
  });

  for (const p of projekty) {
    const dnu = dnuDoTerminu(p.endDate);
    // Zajima nas jen sedmy den pred terminem; blizsi terminy uz clovek vidi
    // barevne v prehledu a zvonek by se z toho stal denni budik.
    if (dnu !== DNU_PRED_TERMINEM) {
      vysledek.preskoceno += 1;
      continue;
    }
    if (await isRodnyListProjectType(p.projectType)) {
      vysledek.preskoceno += 1;
      continue;
    }

    const nazev = p.name?.trim() || `Projekt ${p.caflouProjectId}`;
    const titulek = `Blíží se termín: ${nazev}`;

    // Poslano uz? Radek pod zvonkem je jen jeden na projekt a termin.
    const uz = await prisma.notification.findFirst({
      where: {
        userId: { in: komu },
        kind: 'projekt-termin-blizi',
        title: titulek,
        createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (uz) {
      vysledek.preskoceno += 1;
      continue;
    }

    await notifyMany(komu, {
      kind: 'projekt-termin-blizi',
      title: titulek,
      body: `Do termínu dokončení zbývá ${dnuSlovy(dnu)} (${new Intl.DateTimeFormat('cs-CZ').format(
        p.endDate as Date,
      )}).`,
      url: `/projekty/${encodeURIComponent(p.caflouProjectId)}`,
    });
    vysledek.upozorneno.push({ caflouProjectId: p.caflouProjectId, nazev: p.name });
  }

  return vysledek;
}
