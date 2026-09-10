/**
 * Stavy projektu (zadání 10. 9. 2026 — cesta projektu „Natáčení a postprodukce
 * audioknihy").
 *
 * Do teď stav přicházel z Caflou a portál ho jen ukazoval. Mediaspace ale
 * Caflou opouští, takže od téhle chvíle je stav VLASTNÍ ÚDAJ PORTÁLU a přehazuje
 * se ručně (některé přechody později automaticky — viz níž).
 *
 * POŘADÍ NENÍ NÁHODNÉ: seznam jde tak, jak projekt opravdu putuje, aby se
 * v nabídce hledal ten správný stav a ne aby se lovil v abecedě.
 *
 * Co je zatím ruční a co poběží samo:
 *   - „Dotočeno" se má překlopit samo, jakmile je s hercem dotočeno a na disku
 *     ještě není ani jeden track.
 *   - „Čekáme na opravy" se má překlopit samo sedm dní po „Dokončeno -
 *     ke schválení" a odejít o tom zpráva klientovi.
 * Obojí čeká na napojení na disk a na nastavení notifikací u firmy; do té doby
 * jde přehodit obojí ručně, aby to nikoho neblokovalo.
 */

export type StavProjektu = {
  /** Přesně ten text, který se ukládá a ukazuje. */
  nazev: string;
  /** Jednou větou, kdy se do stavu přechází — vysvětlivka u nabídky. */
  popis: string;
  /** Rozpracovaný projekt = patří do záložky Aktivní. */
  rozpracovany: boolean;
};

export const STAVY_PROJEKTU: StavProjektu[] = [
  {
    nazev: 'V přípravě',
    popis: 'Objednávka přišla, projekt je založený, ještě se neplánuje.',
    rozpracovany: true,
  },
  {
    nazev: 'Natáčíme',
    popis: 'S hercem je naplánováno.',
    rozpracovany: true,
  },
  {
    nazev: 'Natáčíme/stříháme',
    popis: 'Ještě se natáčí a na disku už jsou první zpracované tracky k poslechu.',
    rozpracovany: true,
  },
  {
    nazev: 'Dotočeno',
    popis: 'S hercem dotočeno, na disku zatím není ani jeden track.',
    rozpracovany: true,
  },
  {
    nazev: 'Dotočeno/stříháme',
    popis: 'S hercem dotočeno a na disku už jsou první tracky.',
    rozpracovany: true,
  },
  {
    nazev: 'Dokončeno - ke schválení',
    popis: 'Na disku jsou všechny tracky, čekáme na finální opravy od klienta.',
    rozpracovany: true,
  },
  {
    nazev: 'Čekáme na opravy',
    popis: 'Sedm dní po odevzdání klient opravy nedodal.',
    rozpracovany: true,
  },
  {
    nazev: 'Schváleno - k fakturaci',
    popis: 'Opravené nahrávky jsou na disku, projekt je hotový.',
    rozpracovany: false,
  },
];

const NAZVY = STAVY_PROJEKTU.map((s) => s.nazev);

/** Je to stav z naší cesty projektu? Staré stavy z Caflou tu být nemusí. */
export function jeNasStav(nazev: string | null | undefined): boolean {
  return Boolean(nazev) && NAZVY.includes(nazev as string);
}

/**
 * Je projekt v tomhle stavu dokončený?
 *
 * Rozhoduje jen náš seznam. Stav, který v něm není (přenesený z Caflou),
 * se tímhle neřídí — o tom rozhoduje příznak `finished` u projektu.
 */
export function stavJeDokonceny(nazev: string | null | undefined): boolean | null {
  const stav = STAVY_PROJEKTU.find((s) => s.nazev === nazev);
  return stav ? !stav.rozpracovany : null;
}

export function popisStavu(nazev: string | null | undefined): string | null {
  return STAVY_PROJEKTU.find((s) => s.nazev === nazev)?.popis ?? null;
}
