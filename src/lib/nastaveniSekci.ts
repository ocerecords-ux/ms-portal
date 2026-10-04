import type { KlicSekce } from '@/lib/pristupy';
import { prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * NASTAVENÍ SEKCE POD OZUBENÝM KOLEM (zadání 28. 9. 2026: „pojďme udělat
 * v každé sekci ozubené kolo, kde budeme nastavovat dané věci k té sekci").
 *
 * PROČ TO NENÍ JEDNA VELKÁ ADMINISTRACE: nastavení se hledá tam, kde člověk
 * zrovna stojí. Kdo píše klientovi z Projektů, chce texty těch zpráv po ruce -
 * ne v seznamu dvaceti položek administrace, kde si musí vzpomenout, jak se
 * obrazovka jmenuje.
 *
 * CO SEM PATŘÍ A CO NE (upřesnění téhož dne): tady se nastavuje, JAK TO VYPADÁ
 * A CO SE PÍŠE pro celý portál. Individuální nastavení konkrétní firmy - komu
 * to chodí a jestli vůbec - zůstává na kartě firmy pod záložkou Notifikace.
 * To se nesmí rozdvojit: jedno znění, u firmy jen komu se posílá.
 *
 * Kolečko se ukáže jen u sekce, která tu je - viz maNastaveni().
 */

export type NastaveniSekce = {
  klic: KlicSekce;
  /** Kam kolečko vede. */
  cesta: string;
  /** Nadpis stránky nastavení. */
  nadpis: string;
  /** Jedna věta pod nadpisem - co se tu nastavuje a co ne. */
  popis: string;
};

export const NASTAVENI_SEKCI: NastaveniSekce[] = [
  {
    klic: 'PROJEKTY',
    cesta: '/admin/nastaveni/projekty',
    nadpis: 'Nastavení projektů',
    popis:
      'Zprávy, které z portálu chodí klientovi, když projekt přejde do dalšího stavu - znění pro audioknihy i pro reklamy a za jak dlouho po změně stavu odejdou. Komu a jestli vůbec se posílá, se nastavuje na kartě konkrétní firmy pod Notifikacemi.',
  },
  {
    klic: 'DOKLADY',
    cesta: '/admin/nastaveni/doklady',
    nadpis: 'Nastavení dokladů',
    popis:
      'E-maily, které z portálu odcházejí k dokladům - kdy se upomíná a co se v upomínce píše, a údaje firem, ze kterých vystavujeme.',
  },
  {
    klic: 'PROCESY',
    cesta: '/admin/procesy',
    nadpis: 'Správa procesů',
    popis:
      'Psaní pracovních postupů a technických specifikací. U každého článku se zaškrtne, kdo ho uvidí - bez zaškrtnutí ho má celý tým.',
  },
  {
    klic: 'FIRMY',
    cesta: '/admin/nastaveni/firmy',
    nadpis: 'Nastavení firem',
    popis:
      'Co portál rozesílá kolem firem a zakázek - zprávy, které chodí nám, ceníky, ze kterých se počítají sazby, a vzory natáčecích textů.',
  },
];

const PODLE_KLICE = new Map(NASTAVENI_SEKCI.map((n) => [n.klic, n]));

/**
 * Nadpis a popis sekce podle KÓDU, ne podle českého názvu (vzor `nazevMeny`
 * z dávky 4). Jazyk je NEPOVINNÝ - bez něj zůstává čeština jako zdroj pravdy.
 */
export function textSekce(
  n: NastaveniSekce,
  cast: 'nadpis' | 'popis',
  jazyk?: Jazyk,
): string {
  if (!jazyk || jazyk === 'cs') return n[cast];
  const klic = `nastaveniSekce.${n.klic}.${cast}`;
  const text = prelozit(jazyk, klic);
  return text === klic ? n[cast] : text;
}

/** Nastavení té sekce, nebo null, když ho zatím nemá. */
export function nastaveniSekce(klic: KlicSekce): NastaveniSekce | null {
  return PODLE_KLICE.get(klic) ?? null;
}

/** Nastavení podle poslední části adresy (`/admin/nastaveni/projekty`). */
export function nastaveniPodleCesty(uryvek: string): NastaveniSekce | null {
  return NASTAVENI_SEKCI.find((n) => n.cesta.endsWith(`/${uryvek}`)) ?? null;
}
