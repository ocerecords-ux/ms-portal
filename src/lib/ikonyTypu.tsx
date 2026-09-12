/**
 * Ikony typů projektu (zadání 10. 9. 2026: „udělej nějaké ikony v našich
 * barvách, kterýma budeme rozlišovat typy projektu, bude to svítit před
 * názvem projektu").
 *
 * JEDNA RODINA. Mřížka 24, tah 1.8, zakulacené konce, žádná výplň — vedle
 * sebe pak vypadají jako sada, ne jako posbírané klipy.
 *
 * BARVA JE JEDNA, LIŠÍ SE TVAR. V řádku projektu už barvy jsou: bublina
 * stavu jich nese osm a nese je záměrně. Kdyby typ přidal další, seznam se
 * rozsvítí a barva stavu přestane být informace. Ikona je proto vždycky
 * firemní fialová.
 *
 * IKONA SE NEHÁDÁ. Typ projektu se bere z Ceníku, takže i ikona patří
 * k položce ceníku (PriceListItem.ikona) - položka bez ikony ji prostě nemá.
 * Hádat ji podle názvu by mátlo víc, než když tam nic není.
 */

export type KlicIkony = string;

type Ikona = { klic: KlicIkony; popisek: string; kresba: React.ReactNode };

/** Nabídka ikon. Přidat další znamená dopsat sem jeden řádek. */
export const IKONY_TYPU: Ikona[] = [
  {
    klic: 'kniha',
    popisek: 'Kniha',
    kresba: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v13.5H6.5A2.5 2.5 0 0 0 4 19z" />
        <path d="M4 19a2.5 2.5 0 0 0 2.5 2.5H19" />
      </>
    ),
  },
  {
    klic: 'sluchatka',
    popisek: 'Sluchátka',
    kresba: (
      <>
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <rect x="2.5" y="13.5" width="4.5" height="7" rx="2.25" />
        <rect x="17" y="13.5" width="4.5" height="7" rx="2.25" />
      </>
    ),
  },
  {
    klic: 'mikrofon',
    popisek: 'Mikrofon',
    kresba: (
      <>
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
        <path d="M12 17.5v4" />
      </>
    ),
  },
  {
    klic: 'mikrofon-studio',
    popisek: 'Studiový mikrofon',
    kresba: (
      <>
        <rect x="8" y="2.5" width="8" height="12" rx="4" />
        <path d="M8 6.5h8M8 10.5h8" />
        <path d="M12 14.5v4M8.5 21.5h7" />
      </>
    ),
  },
  {
    klic: 'vlny',
    popisek: 'Vysílání',
    kresba: (
      <>
        <circle cx="12" cy="12" r="2" />
        <path d="M8.5 8.5a5 5 0 0 0 0 7" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M5.5 5.5a9 9 0 0 0 0 13" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ),
  },
  {
    klic: 'vlna',
    popisek: 'Zvuková vlna',
    kresba: <path d="M2.5 10.5v3M7 5.5v13M11.5 8.5v7M16 3.5v17M20.5 9.5v5" />,
  },
  {
    klic: 'ekvalizer',
    popisek: 'Ekvalizér',
    kresba: (
      <>
        <path d="M5 21V3M12 21V3M19 21V3" />
        <circle cx="5" cy="8" r="2" />
        <circle cx="12" cy="15" r="2" />
        <circle cx="19" cy="7" r="2" />
      </>
    ),
  },
  {
    klic: 'reproduktor',
    popisek: 'Reproduktor',
    kresba: (
      <>
        <path d="M3.5 9.5H7L12.5 5v14L7 14.5H3.5z" />
        <path d="M16 9.5a4 4 0 0 1 0 5" />
        <path d="M18.5 7a7.5 7.5 0 0 1 0 10" />
      </>
    ),
  },
  {
    klic: 'megafon',
    popisek: 'Reklama',
    kresba: (
      <>
        <path d="M3 11.5v-4l14-4v12z" />
        <path d="M17 6.5a3 3 0 0 1 0 6" />
        <path d="M6.5 12.5 8 20.5h3l-1-8" />
      </>
    ),
  },
  {
    klic: 'klapka',
    popisek: 'Klapka / film',
    kresba: (
      <>
        <rect x="2.5" y="7" width="19" height="14" rx="2.5" />
        <path d="M2.5 11.5h19" />
        <path d="m5 7 2.5-3.5M11 7l2.5-3.5M17 7l2.5-3.5" />
      </>
    ),
  },
  {
    klic: 'obrazovka',
    popisek: 'Obrazovka / TV',
    kresba: (
      <>
        <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
        <path d="M12 17v4M8 21h8" />
      </>
    ),
  },
  {
    klic: 'noty',
    popisek: 'Hudba',
    kresba: (
      <>
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="17.5" cy="15.5" r="2.5" />
        <path d="M9 18V6l11-2.5v12" />
      </>
    ),
  },
  {
    klic: 'zvonek',
    popisek: 'Znělka',
    kresba: (
      <>
        <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9" />
        <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
      </>
    ),
  },
  {
    klic: 'globus',
    popisek: 'Lokalizace',
    kresba: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
      </>
    ),
  },
  {
    klic: 'vlajka',
    popisek: 'Jazyková mutace',
    kresba: (
      <>
        <path d="M5 21V4" />
        <path d="M5 4.5h11l-1.8 3.5L16 11.5H5z" />
      </>
    ),
  },
  {
    klic: 'lide',
    popisek: 'Casting',
    kresba: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" />
        <path d="M17.5 14.3a6.5 6.5 0 0 1 4 5.7" />
      </>
    ),
  },
  {
    klic: 'hodiny',
    popisek: 'Termín',
    kresba: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5.5l3.5 2" />
      </>
    ),
  },
  {
    klic: 'dokument',
    popisek: 'Dokument',
    kresba: (
      <>
        <path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z" />
        <path d="M14 2.5V8h5.5" />
      </>
    ),
  },
  {
    klic: 'stitek',
    popisek: 'Štítek',
    kresba: (
      <>
        <path d="M3.5 11V4.5H10L20.5 15 14 21.5z" />
        <circle cx="7.2" cy="8.2" r="1.3" />
      </>
    ),
  },
  {
    klic: 'hvezda',
    popisek: 'Hvězda',
    kresba: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />,
  },
  {
    klic: 'blesk',
    popisek: 'Rychlovka',
    kresba: <path d="M13.5 2.5 4.5 13.5h6l-1 8 9-11h-6z" />,
  },
  {
    klic: 'ovladac',
    popisek: 'Hra',
    kresba: (
      <>
        <rect x="2.5" y="7" width="19" height="10" rx="4" />
        <path d="M7 10.5v3M5.5 12h3" />
        <circle cx="16" cy="11" r="1" />
        <circle cx="18.5" cy="13.5" r="1" />
      </>
    ),
  },
  {
    klic: 'telefon',
    popisek: 'Telefon',
    kresba: (
      <path d="M5.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2" />
    ),
  },
  {
    klic: 'srdce',
    popisek: 'Srdce',
    kresba: <path d="M12 20.5S3.5 15 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5" />,
  },
];

const PODLE_KLICE = new Map(IKONY_TYPU.map((i) => [i.klic, i]));

export function najdiIkonu(klic: string | null | undefined): Ikona | null {
  const k = klic?.trim();
  return k ? PODLE_KLICE.get(k) ?? null : null;
}

export function popisekIkony(klic: string | null | undefined): string | null {
  return najdiIkonu(klic)?.popisek ?? null;
}

/** Je tenhle klíč z naší nabídky? Cokoliv jiného se neuloží. */
export function jeKlicIkony(klic: string): boolean {
  return PODLE_KLICE.has(klic);
}

/** Samotná kresba - barvu si bere z okolí (currentColor). */
export function KresbaIkony({ klic, velikost = 17 }: { klic: string; velikost?: number }) {
  const ikona = najdiIkonu(klic);
  if (!ikona) return null;
  return (
    <svg
      width={velikost}
      height={velikost}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ikona.kresba}
    </svg>
  );
}

/**
 * Odznak před názvem projektu - kroužek se světle fialovým podkladem.
 * Když typ ikonu nemá, nevykreslí se vůbec (ani prázdné místo).
 */
export function IkonaTypu({
  klic,
  /** Název typu do bublinky - barevný tvar bez vysvětlení je hádanka. */
  typProjektu,
  /**
   * V tabulce projektů drží prázdné místo i tam, kde ikona není (zadání
   * 12. 9. 2026) - jinak by se název u projektu bez ikony posunul doleva
   * a sloupec by se rozjel. Jinde se prostě nevykreslí nic.
   */
  mezeraKdyzNeni = false,
}: {
  klic: string | null | undefined;
  typProjektu?: string | null;
  mezeraKdyzNeni?: boolean;
}) {
  const ikona = najdiIkonu(klic);
  if (!ikona) {
    return mezeraKdyzNeni ? <span aria-hidden="true" className="shrink-0 w-[30px] h-[30px]" /> : null;
  }
  return (
    <span
      title={typProjektu || ikona.popisek}
      className="shrink-0 inline-grid place-items-center w-[30px] h-[30px] rounded-pill bg-brand-purple/15 text-brand-purpleDeep dark:text-brand-purpleLight"
    >
      <KresbaIkony klic={ikona.klic} />
    </span>
  );
}
