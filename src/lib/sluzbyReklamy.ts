/**
 * CO SI KLIENT U REKLAMY OBJEDNÁVÁ (zadání 25. 9. 2026: „pojďme hromadně
 * předělat objednávky u klientů reklam… Typ projektu: Natáčení voiceoveru,
 * zvuková postprodukce, Sound design — tady bych dal u toho i ikony a klient
 * toho může vybrat více").
 *
 * U audioknihy je zakázka jedna věc (natočit a vyrobit knihu) a počítá se
 * z normostran. U reklamy si klient skládá, co od nás chce - a klidně víc
 * věcí naráz. Proto vlastní číselník, ne typ projektu z ceníku: typ projektu
 * je JEDEN a slouží nám k rozpočtu, tohle je přání klienta.
 *
 * `cenik` je název položky ceníku, pokud jí služba odpovídá - z toho se bude
 * počítat předběžná cena, až se doladí (zadání tentýž den: „uděláme tam nějaké
 * výpočty ceny apod."). Co v ceníku není, zůstane bez ceny a domluví se.
 *
 * SOUBOR JE BEZ PRISMY, ať si ho vezme formulář v prohlížeči i server.
 */
export type SluzbaReklamy = {
  klic: string;
  nazev: string;
  /** Klíč ikony z lib/ikonyTypu.tsx. */
  ikona: string;
  popis: string;
  /** Odpovídající položka ceníku, když existuje. */
  cenik?: string;
};

export const SLUZBY_REKLAMY: SluzbaReklamy[] = [
  {
    klic: 'voiceover',
    nazev: 'Natáčení voiceoveru',
    ikona: 'mikrofon-studio',
    popis: 'Namluvíme text ve studiu — herec, režie, čistý záznam.',
    cenik: 'Natáčení voiceoveru',
  },
  {
    klic: 'postprodukce',
    nazev: 'Zvuková postprodukce',
    ikona: 'ekvalizer',
    popis: 'Střih, čištění, mix a mastering hotového materiálu.',
    cenik: 'Zvuková postprodukce',
  },
  {
    klic: 'sounddesign',
    nazev: 'Sound design',
    ikona: 'vlny',
    popis: 'Ruchy, atmosféry a hudební podkres — zvuk, který spot posune.',
  },
];

export function sluzbaPodleKlice(klic: string): SluzbaReklamy | null {
  return SLUZBY_REKLAMY.find((s) => s.klic === klic) ?? null;
}

/** Názvy vybraných služeb v pořadí číselníku - do e-mailu i do projektu. */
export function nazvySluzeb(klice: string[] | null | undefined): string[] {
  if (!klice || klice.length === 0) return [];
  return SLUZBY_REKLAMY.filter((s) => klice.includes(s.klic)).map((s) => s.nazev);
}
