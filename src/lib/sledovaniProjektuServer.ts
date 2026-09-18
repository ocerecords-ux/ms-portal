import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { POPISKY_POLI } from '@/lib/projektLog';

/**
 * ZVONEČEK PŘI ZMĚNĚ U PROJEKTU (zadání 18. 9. 2026: „potřebuju ještě, ať
 * Peter vidí ve zvonečku notifikace o změně data a změně stavu projektu").
 *
 * Kdo je dostává, se zaškrtává NA KARTĚ UŽIVATELE (User.sledujeZmenyProjektu),
 * ne podle jména v kódu — stejně jako manažer projektu, podpis smluv nebo
 * přístup k bance. Lidi se mění, kód by o tom nevěděl.
 *
 * VÝCHOZÍ JE NE. Kdyby zvonek zvonil při každé změně všem, po týdnu by ho
 * nikdo nečetl — a přestal by fungovat i tam, kde je opravdu potřeba.
 *
 * TOMU, KDO ZMĚNU UDĚLAL, NIC NECHODÍ. Vlastní kliknutí si člověk pamatuje;
 * upozornění na něj je jen šum.
 */

/** Pole, u kterých se zvonek ozve. Co tu není, jde jen do historie projektu. */
const POLE_STAVU = 'statusName';
const POLE_TERMINU = ['endDate', 'releaseDate', 'productionDate'];

export type ZmenaProZvonek = {
  pole: string;
  predchozi: string;
  nova: string;
};

/**
 * Pošle upozornění pod zvonek těm, kdo mají změny u projektů zapnuté.
 *
 * NIKDY NEVYHAZUJE — upozornění je doprovod uložené změny, ne ta změna sama.
 * Volá se z lib/projektLogServer.ts, tedy ze všech cest naráz: ruční úpravy
 * projektu, tlačítko Dotočeno, odeslaná faktura, ukončení i automat „Čekáme
 * na opravy".
 */
export async function posliZvonekOZmenach(vstup: {
  caflouProjectId: string;
  zmeny: ZmenaProZvonek[];
  /** Kdo změnu udělal — tomu se neposílá. Automat (Bruno, cron) nemá ID. */
  puvodceId?: string | null;
}): Promise<void> {
  try {
    const stav = vstup.zmeny.find((z) => z.pole === POLE_STAVU) ?? null;
    const terminy = vstup.zmeny.filter((z) => POLE_TERMINU.includes(z.pole));
    if (!stav && terminy.length === 0) return;

    const prijemci = await prisma.user.findMany({
      where: { active: true, sledujeZmenyProjektu: true },
      select: { id: true },
    });
    const komu = prijemci.map((u) => u.id).filter((id) => id !== vstup.puvodceId);
    if (komu.length === 0) return;

    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: vstup.caflouProjectId },
      select: { name: true },
    });
    const nazev = projekt?.name?.trim() || `Projekt ${vstup.caflouProjectId}`;
    const url = `/projekty/${encodeURIComponent(vstup.caflouProjectId)}`;

    if (stav) {
      await notifyMany(komu, {
        kind: 'projekt-stav',
        title: `Změna stavu: ${nazev}`,
        body: `${stav.predchozi} → ${stav.nova}`,
        url,
      });
    }

    if (terminy.length > 0) {
      // Vic termínů naráz je jedno upozornění - zvonek má říct „u projektu se
      // hýbe termín", ne zaplnit se třemi řádky o tomtéž uložení.
      await notifyMany(komu, {
        kind: 'projekt-termin',
        title: `Změna termínu: ${nazev}`,
        body: terminy
          .map((t) => `${POPISKY_POLI[t.pole] ?? t.pole}: ${t.predchozi} → ${t.nova}`)
          .join(' · '),
        url,
      });
    }
  } catch (err) {
    console.error('posliZvonekOZmenach selhalo:', err);
  }
}
