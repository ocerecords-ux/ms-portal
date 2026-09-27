/**
 * VÝCHOZÍ SADY TECHNICKÝCH PARAMETRŮ (zadání 27. 9. 2026).
 *
 * Opsáno z dokumentu „VÝROBA AUDIOKNIH", který Ondřej poslal, a z paušálu pro
 * reklamy, který k tomu napsal. Zakládá se to JEN JEDNOU - jakmile někdo sadu
 * v portálu upraví, seed do ní už nesahá, jinak by každé nasazení přepsalo,
 * co člověk nastavil.
 *
 * `firmy` jsou názvy, na které se sada napojí, když se firma v portálu najde
 * (porovnává se bez ohledu na velikost písmen a diakritiku). Co se nenajde,
 * se přeskočí - sada zůstane a firma se k ní přiřadí ručně.
 */
export type VychoziSada = {
  nazev: string;
  druh: 'AUDIOKNIHA' | 'REKLAMA';
  perex?: string;
  vychozi?: boolean;
  poradi?: number;
  firmy?: string[];
  sekce: { nadpis: string; radky: string[]; sluzba?: string; jenRadio?: boolean }[];
};

/** Společný postup, který platí u audioknih bez ohledu na nakladatelství. */
const VYROBA_AUDIOKNIHY = [
  {
    nadpis: 'Natáčení',
    radky: [
      'Natáčí se vždy do template „AUDIOKNIHA" v Cubase',
      'Nastavení projektu: 44 kHz / 32bit float',
      'Natáčí se nástřihem',
      'Na začátku projektu nastavit gain a zapsat do názvu stopy VO',
      'Do textu patří vždy úvod a závěr (např. „Audiotéka uvádí…", „Slyšeli jste…")',
      'Kapitoly oddělujeme podle připraveného tracklistu (zarovnáváme na celou hodinu)',
    ],
  },
  {
    nadpis: 'Postprodukce',
    radky: [
      'Nádechy čistíme — přesunout do separátní stopy (COMMAND), nebo smazat',
      'Myšlenkové předěly oddělujeme jinglem',
    ],
  },
  {
    nadpis: 'Export',
    radky: ['Do složky mixdown ve složce projektu', 'Soubory popisujeme podle připraveného tracklistu'],
  },
];

export const VYCHOZI_SADY: VychoziSada[] = [
  {
    nazev: 'Audioknihy — obecně',
    druh: 'AUDIOKNIHA',
    perex: 'Postup, který platí u každé audioknihy. Použije se, když nakladatelství nemá vlastní sadu.',
    vychozi: true,
    poradi: 10,
    sekce: VYROBA_AUDIOKNIHY,
  },
  {
    nazev: 'Audiotéka',
    druh: 'AUDIOKNIHA',
    poradi: 20,
    firmy: ['Audiotéka', 'Audioteka'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      { nadpis: 'Odevzdání', radky: ['mp3 128 kbps, stereo', 'Tracky dělíme po 30 minutách'] },
    ],
  },
  {
    nazev: 'Audiolibrix / Publixing',
    druh: 'AUDIOKNIHA',
    poradi: 30,
    firmy: ['Audiolibrix', 'Publixing'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      {
        nadpis: 'Odevzdání',
        radky: [
          'mp3 128 kbps, stereo (pro poslech a platformu)',
          'wav 44,1 kHz / 24bit (pro archivaci)',
        ],
      },
      {
        nadpis: 'Hlasitost',
        radky: [
          'Hlasitost nahrávky mezi −18 a −3 dB RMS',
          'Studiové ticho nepřevyšuje −55 dB RMS',
          'Maximální peak −1 dB',
        ],
      },
    ],
  },
  {
    nazev: 'Albatros',
    druh: 'AUDIOKNIHA',
    poradi: 40,
    firmy: ['Albatros', 'Albatros Media'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      {
        nadpis: 'Odevzdání',
        radky: [
          'mp3 44 kHz, 128 kbps, 16bit',
          'Jednohlasá četba s hudbou na začátku a konci a s hudebními předěly mezi kapitolami',
          'Kapitoly rozdělené do tracků, žádný delší než 30 minut',
        ],
      },
      {
        nadpis: 'Názvy souborů',
        radky: [
          'Číslo tracku_Název audioknihy, bez diakritiky, mezi slovy pomlčky',
          'Příklad: 01_Nesmrtelna-teta.mp3',
          'Číslujeme 01, 02, 03… — u víc než 100 tracků trojmístně (001_Kazatel)',
          'U vícedílné série patří díl do názvu: 01_Denik_maleho_poseroutky_05.mp3',
        ],
      },
      {
        nadpis: 'Tagy',
        radky: [
          'title: název kapitoly přesně podle knihy; bez názvů kapitol kopíruje název tracku s diakritikou',
          'artist: autor knihy',
          'albumartist: herec',
          'album: název audioknihy',
          'date: rok vydání',
          'genre: Speech',
          '# číslo tracku: 01, 02, 03…',
          'label: Voxi',
        ],
      },
    ],
  },
  {
    nazev: 'Témbr',
    druh: 'AUDIOKNIHA',
    poradi: 50,
    firmy: ['Témbr', 'Tembr'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      {
        nadpis: 'Úvodní věta audioknihy',
        radky: [
          '„Nakladatelství Témbr uvádí audioknihu (pauza): AUTOR: NÁZEV KNIHY (pauza) čte / čtou (herec), (pauza) režie (režisér)"',
          'U překladu se za název doplní „překlad (jméno překladatele)"',
          'U koprodukce: „Nakladatelství Témbr a Vydavatelství Host uvádějí audioknihu…"',
        ],
      },
      {
        nadpis: 'Úvodní věta audioukázky',
        radky: [
          '„Nakladatelství Témbr uvádí audioknihu: AUTOR: NÁZEV KNIHY" a hned text první nebo jinak atraktivní kapitoly',
          'Herci ani režie se v ukázce nečtou',
          'Ideální délka 4–6 minut',
        ],
      },
      {
        nadpis: 'Tagy',
        radky: [
          'autor → writer',
          'nazev_titulu → album',
          'nazev_original → album original',
          'interpret → artist',
          'rezie → director',
          'cover',
        ],
      },
    ],
  },
  {
    nazev: 'Jan Melvil',
    druh: 'AUDIOKNIHA',
    poradi: 60,
    firmy: ['Jan Melvil', 'Melvil'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      { nadpis: 'Odevzdání', radky: ['mp3 128 kbps, 44,1 kHz, stereo', 'Stopy max do 30 minut'] },
    ],
  },
  {
    nazev: 'Euromedia',
    druh: 'AUDIOKNIHA',
    poradi: 70,
    firmy: ['Euromedia'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      {
        nadpis: 'Odevzdání',
        radky: ['mp3 192 kbps, 44,1 kHz, stereo', 'Stopy max do 30 minut', 'Soubory tagujeme'],
      },
    ],
  },
  {
    nazev: 'Zoner',
    druh: 'AUDIOKNIHA',
    poradi: 80,
    firmy: ['Zoner'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      { nadpis: 'Odevzdání', radky: ['mp3 128 kbps, 44,1 kHz, stereo', 'Stopy max do 30 minut'] },
    ],
  },
  {
    nazev: 'Jota',
    druh: 'AUDIOKNIHA',
    poradi: 90,
    firmy: ['Jota'],
    sekce: [
      ...VYROBA_AUDIOKNIHY,
      { nadpis: 'Odevzdání', radky: ['mp3 128 kbps, 44,1 kHz, stereo', 'Stopy max do 30 minut'] },
    ],
  },
  {
    nazev: 'Reklamy',
    druh: 'REKLAMA',
    perex: 'U reklam je to paušální — ukazuje se jen to, co si klient u projektu objednal.',
    vychozi: true,
    poradi: 10,
    sekce: [
      {
        nadpis: 'Voiceover — nábor',
        sluzba: 'voiceover',
        radky: ['Výstup wav, 32bit, mono'],
      },
      {
        nadpis: 'Voiceover — postprodukce',
        sluzba: 'postprodukce',
        radky: ['Online: wav 32bit, stereo', 'TV: wav 24bit, stereo'],
      },
      {
        nadpis: 'Rádiový spot',
        jenRadio: true,
        radky: ['Výstup mp3 320 kbps'],
      },
    ],
  },
];
