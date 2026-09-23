/**
 * Ikony typů projektu (zadání 10. 9. 2026: „udělej nějaké ikony v našich
 * barvách, kterýma budeme rozlišovat typy projektu, bude to svítit před
 * názvem projektu").
 *
 * JEDNA RODINA. Mřížka 24, tah 1.8, zakulacené konce, žádná výplň — vedle
 * sebe pak vypadají jako sada, ne jako posbírané klipy.
 *
 * BARVA SE LIŠÍ PODLE RODINY (zadání 15. 9. 2026: „jsou tvarově ok, ale bylo
 * by dobré je udělat v různých barvách, ať se ti hezky odliší v tom seznamu").
 * Do té doby byly všechny firemně fialové, aby barvu v řádku držela jenom
 * bublina stavu - jenže při deseti typech se od sebe samotné tvary v 17 px
 * poznávaly těžko.
 *
 * Barev je proto MÁLO A TLUMENÝCH: kolečko je podklad na 15 % a barevná je
 * až kresba. Typy si je dělí po rodinách (audiokniha, vysílání, nahrávání,
 * postprodukce, obraz, jazyky, lidé, ostatní), takže seznam rozlišuje, ale
 * nesvítí - a bublina stavu vedle toho zůstane tím nejvýraznějším.
 *
 * IKONA SE NEHÁDÁ. Typ projektu se bere z Ceníku, takže i ikona patří
 * k položce ceníku (PriceListItem.ikona) - položka bez ikony ji prostě nemá.
 * Hádat ji podle názvu by mátlo víc, než když tam nic není.
 */

export type KlicIkony = string;

/** Rodiny barev. Víc jich schválně není - viz poznámka nahoře. */
export type BarvaIkony =
  | 'fialova'
  | 'zelena'
  | 'jantarova'
  | 'modra'
  | 'tyrkysova'
  | 'ruzova'
  | 'seda';

/**
 * Třídy kolečka pro každou rodinu. Podklad je vždycky slabý, barvu nese
 * kresba; v tmavém režimu se kresba rozsvítí, aby ji bylo vidět.
 */
export const TRIDY_BAREV: Record<BarvaIkony, string> = {
  fialova: 'bg-brand-purple/15 text-brand-purpleDeep dark:text-brand-purpleLight',
  zelena: 'bg-brand-green/15 text-brand-greenDeep dark:text-brand-green',
  jantarova: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  modra: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  tyrkysova: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  ruzova: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  seda: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
};

type Ikona = { klic: KlicIkony; popisek: string; barva: BarvaIkony; kresba: React.ReactNode };

/** Třídy kolečka pro daný klíč; neznámá ikona dostane firemní fialovou. */
export function tridaBarvyIkony(klic: string | null | undefined): string {
  return TRIDY_BAREV[najdiIkonu(klic)?.barva ?? 'fialova'];
}

/** Nabídka ikon. Přidat další znamená dopsat sem jeden řádek. */
export const IKONY_TYPU: Ikona[] = [
  {
    klic: 'kniha',
    barva: 'fialova',
    popisek: 'Kniha',
    kresba: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v13.5H6.5A2.5 2.5 0 0 0 4 19z" />
        <path d="M4 19a2.5 2.5 0 0 0 2.5 2.5H19" />
      </>
    ),
  },
  {
    // Zadani 12. 9. 2026: „pro audioknihu bych udelal knihu ve spojeni
    // s mikrofonem". Kniha drzi levou polovinu, mikrofon stoji vpravo - dva
    // tvary vedle sebe se v 17 px prectou lip nez jeden slozity.
    klic: 'kniha-mikrofon',
    barva: 'fialova',
    popisek: 'Audiokniha (kniha a mikrofon)',
    kresba: (
      <>
        <path d="M2.5 6A2.5 2.5 0 0 1 5 3.5h5v13H5a2.5 2.5 0 0 0-2.5 2.5z" />
        <path d="M2.5 19A2.5 2.5 0 0 0 5 21.5h5" />
        <rect x="14.75" y="2.5" width="5.5" height="9" rx="2.75" />
        <path d="M12.5 10a5 5 0 0 0 10 0" />
        <path d="M17.5 15v4" />
      </>
    ),
  },
  {
    // Zadani 12. 9. 2026: „pro radiovy spot bych jeste vytvoril ikonku
    // radia". Prijimac s antenou, ladicim kolečkem a stupnici.
    klic: 'radio',
    barva: 'jantarova',
    popisek: 'Rádio (rádiový spot)',
    kresba: (
      <>
        <path d="M17.5 2.5 9 6.5" />
        <rect x="2.5" y="6.5" width="19" height="14.5" rx="2.5" />
        <circle cx="16" cy="13.75" r="3.25" />
        <path d="M6 11h5" />
        <path d="M6 15h3" />
      </>
    ),
  },
  {
    // Zadani 12. 9. 2026: „Natáčení voiceoveru + zvukový mix - tam bych udelal
    // ikonu mikrofon + mixazni pult". Pult jsou dva fadery s cepickou; tri uz
    // by se v te velikosti slily.
    klic: 'mikrofon-mix',
    barva: 'modra',
    popisek: 'Mikrofon a mixážní pult',
    kresba: (
      <>
        <rect x="3.5" y="2.5" width="5" height="8" rx="2.5" />
        <path d="M1.5 9.5a4.5 4.5 0 0 0 9 0" />
        <path d="M6 14v3" />
        <path d="M14.5 4.5v15" />
        <path d="M19.5 4.5v15" />
        <path d="M12.75 9.5h3.5" />
        <path d="M17.75 14.5h3.5" />
      </>
    ),
  },
  {
    klic: 'sluchatka',
    barva: 'modra',
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
    barva: 'modra',
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
    barva: 'modra',
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
    barva: 'jantarova',
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
    barva: 'tyrkysova',
    popisek: 'Zvuková vlna',
    kresba: <path d="M2.5 10.5v3M7 5.5v13M11.5 8.5v7M16 3.5v17M20.5 9.5v5" />,
  },
  {
    klic: 'ekvalizer',
    barva: 'tyrkysova',
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
    barva: 'tyrkysova',
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
    barva: 'jantarova',
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
    barva: 'ruzova',
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
    barva: 'ruzova',
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
    barva: 'ruzova',
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
    barva: 'ruzova',
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
    barva: 'zelena',
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
    barva: 'zelena',
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
    barva: 'zelena',
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
    barva: 'seda',
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
    barva: 'seda',
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
    barva: 'seda',
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
    barva: 'jantarova',
    popisek: 'Hvězda',
    kresba: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />,
  },
  {
    klic: 'blesk',
    barva: 'jantarova',
    popisek: 'Rychlovka',
    kresba: <path d="M13.5 2.5 4.5 13.5h6l-1 8 9-11h-6z" />,
  },
  {
    klic: 'ovladac',
    barva: 'ruzova',
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
    barva: 'seda',
    popisek: 'Telefon',
    kresba: (
      <path d="M5.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2" />
    ),
  },
  {
    /**
     * REŽIE NA DÁLKU (zadání 23. 9. 2026: „spíš bych zvolil ikonu telefonu
     * nějakého na dálku a režiséra, místo sluchátek"). Sluchátko a vlny -
     * režie připojená na hovor, ne člověk ve studiu. Používá ji kalendář
     * u první frekvence s hercem (viz lib/rezieOnline.ts).
     */
    klic: 'rezie-na-dalku',
    barva: 'modra',
    popisek: 'Režie na dálku',
    kresba: (
      <>
        <path d="M4.4 4h2.5l1.2 3.2-1.6 1.2a10 10 0 0 0 4.6 4.6l1.2-1.6 3.2 1.2v2.5a1.7 1.7 0 0 1-1.7 1.7A13.8 13.8 0 0 1 2.7 5.7 1.7 1.7 0 0 1 4.4 4" />
        <path d="M15.2 3.4a6 6 0 0 1 5.4 5.4" />
        <path d="M15 6.8a2.7 2.7 0 0 1 2.2 2.2" />
      </>
    ),
  },
  {
    klic: 'srdce',
    barva: 'ruzova',
    popisek: 'Srdce',
    kresba: <path d="M12 20.5S3.5 15 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5" />,
  },
  /**
   * DRUHY PRÁCE V KALENDÁŘI (zadání 20. 9. 2026: „chci to ve stylu typů
   * projektů"). Stejná mřížka a tah jako zbytek sady; natáčení bere
   * studiový mikrofon výše.
   */
  {
    klic: 'strih',
    barva: 'zelena',
    popisek: 'Střih',
    // Zvukova vlna rozstrizena - dva kusy a mezi nimi strih.
    kresba: (
      <>
        <path d="M3 10.5v3M6 7.5v9M9 9.5v5" />
        <path d="M15 8.5v7M18 6v12M21 10.5v3" />
        <path d="M12 2.5v2.5M12 8v2.5M12 13.5v2.5M12 19v2.5" strokeWidth="1.4" />
      </>
    ),
  },
  {
    klic: 'casting',
    barva: 'ruzova',
    popisek: 'Casting',
    // Hlava a ramena herce, vedle hvezdicka - zkouska, vyber hlasu.
    kresba: (
      <>
        <circle cx="10" cy="8" r="3.6" />
        <path d="M3.5 20.5a6.5 6.5 0 0 1 13 0" />
        <path d="m18.5 3.2.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z" />
      </>
    ),
  },
  {
    klic: 'klic',
    barva: 'seda',
    popisek: 'Údržba',
    kresba: (
      <path d="M14.5 3.8a5 5 0 0 0-5.3 6.6L3.5 16.1v4.4h4.4l5.7-5.7a5 5 0 0 0 6.6-5.3l-3 3-3-.9-.9-3z" />
    ),
  },
  {
    klic: 'letadlo',
    barva: 'modra',
    popisek: 'Externě, mimo studio',
    kresba: (
      <path d="M10.2 12.6 3 10.4l1.6-1.6 3.4.6 2.6-2.6-6.1-3 1.9-1.9 8 2 3.6-3.6a2 2 0 0 1 2.8 2.8l-3.6 3.6 2 8-1.9 1.9-3-6.1-2.6 2.6.6 3.4-1.6 1.6z" />
    ),
  },
  {
    klic: 'slunce',
    barva: 'jantarova',
    popisek: 'Volno',
    kresba: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </>
    ),
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
      className={`shrink-0 inline-grid place-items-center w-[30px] h-[30px] rounded-pill ${tridaBarvyIkony(ikona.klic)}`}
    >
      <KresbaIkony klic={ikona.klic} />
    </span>
  );
}
