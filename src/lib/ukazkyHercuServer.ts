import { prisma } from '@/lib/db';
import { SEKCE, srovnej, type UkazkaData } from '@/lib/prezentaceNabidky';
import { naData } from '@/lib/ukazkyServer';

/**
 * UKÁZKY K NÁVRHŮM HERCŮ (zadání 22. 10. 2026: „ještě bych měl vědět, než budu
 * posílat na klienta, jestli máme ukázku toho herce někde v portálu").
 *
 * Dema jsou v knihovně nabídkových prezentací (`UkazkaNabidky`, druh HEREC) -
 * nikam se nekopírují, jen se k návrhu dohledají. Co se nahraje jednou pro
 * prezentaci, tím pádem rovnou svítí i u návrhu obsazení.
 *
 * PÁRUJE SE NADVAKRÁT:
 *   1. přes účet herce (`herecId`) - to je jistota,
 *   2. a když u ukázky účet není, přes jméno v názvu. Dema se často nahrávala
 *      dřív, než měl herec v portálu účet, a shoda podle jména je v tomhle
 *      případě dost dobrá: nejhorší, co se může stát, je ukázka navíc - nic
 *      se tím nikam neodesílá, je to podklad pro naše rozhodnutí.
 *
 * Porovnává se bez diakritiky a bez ohledu na velikost písmen (`srovnej`),
 * protože „Žáková" a „Zakova" je v názvech souborů běžně obojí.
 */

/** Krátké jméno nestačí - „Eva" by chytila půlku knihovny. */
const NEJKRATSI_JMENO = 4;

/** Víc než pár dem u jednoho jména už není výběr, ale archiv. */
const NEJVIC = 8;

export type NavrhKParovani = {
  id: string;
  userId: string | null;
  jmeno: string | null;
  user: { name: string | null; email: string } | null;
};

export type UkazkyPodleNavrhu = Record<string, UkazkaData[]>;

export function jmenoNavrhu(n: NavrhKParovani): string {
  return (n.user ? n.user.name || n.user.email : n.jmeno) ?? '';
}

export async function ukazkyKNavrhum(navrhy: NavrhKParovani[]): Promise<UkazkyPodleNavrhu> {
  if (navrhy.length === 0) return {};

  const knihovna = await prisma.ukazkaNabidky
    .findMany({
      where: { druh: SEKCE.herec, aktivni: true },
      orderBy: [{ poradi: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        druh: true,
        nazev: true,
        popis: true,
        typSouboru: true,
        delka: true,
        stitky: true,
        herecId: true,
      },
    })
    .catch(() => []);

  if (knihovna.length === 0) return {};

  const vysledek: UkazkyPodleNavrhu = {};
  for (const navrh of navrhy) {
    const podleUctu = navrh.userId
      ? knihovna.filter((u) => u.herecId === navrh.userId)
      : [];

    let nalezene = podleUctu;
    if (nalezene.length === 0) {
      const hledane = srovnej(jmenoNavrhu(navrh));
      if (hledane.length >= NEJKRATSI_JMENO) {
        nalezene = knihovna.filter((u) => {
          // Ukazka patrici jinemu uctu uz je pricena tam, kam patri.
          if (u.herecId && u.herecId !== navrh.userId) return false;
          const nazev = srovnej(u.nazev);
          return nazev.includes(hledane) || hledane.includes(nazev);
        });
      }
    }

    if (nalezene.length > 0) vysledek[navrh.id] = nalezene.slice(0, NEJVIC).map(naData);
  }

  return vysledek;
}
