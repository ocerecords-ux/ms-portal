/**
 * ČTENÍ BANKOVNÍHO VÝPISU VE FORMÁTU ABO (GPC).
 *
 * PROČ TAHLE CESTA (29. 9. 2026): párování mělo jezdit přes GoCardless Bank
 * Account Data, jenže ten přestal brát nové zákazníky, a Enable Banking, což
 * byla druhá varianta, Česko vůbec nepokrývá. Napojit se přímo na PSD2 Air
 * Banky vyžaduje licenci a eIDAS certifikát za desítky tisíc ročně.
 *
 * Výpis ve formátu ABO si ale z internetového bankovnictví stáhne každý a je
 * v něm všechno, co párování potřebuje - datum, částka, variabilní symbol
 * i protiúčet. Žádný prostředník, žádný poplatek, žádný souhlas, který za
 * devadesát dní vyprší.
 *
 * FORMÁT je pevná šířka 128 znaků na řádek, podle specifikace Air Bank
 * („Technické požadavky a specifikace hromadných plateb a exportu výpisů"):
 *
 *   074 = hlavička výpisu - účet, název, zůstatky, pořadové číslo, datum
 *   075 = jedna obratová položka
 *   078 / 079 = doplňující informace k předchozí položce (avízo, IBAN)
 *
 * Soubor je BEZ PRISMY a bez sítě - je to čistý překlad textu na čísla, aby
 * se dal otestovat bez databáze.
 */

/** Jeden pohyb na účtu tak, jak ho výpis popisuje. */
export type AboPohyb = {
  /** Číslo dokladu z banky - spolu s účtem a datem drží jednoznačnost. */
  cisloDokladu: string;
  /** Kladná částka = příchozí platba, záporná = odchozí. V haléřích. */
  castkaMinor: number;
  /** Protiúčet i s kódem banky, jak se píše u nás („123456789/0300"). */
  protiucet: string | null;
  variabilniSymbol: string | null;
  konstantniSymbol: string | null;
  specifickySymbol: string | null;
  /** Datum valuty - den, ke kterému banka pohyb zaúčtovala. */
  datum: Date;
  /** Jméno protistrany nebo poznámka, co banka do řádku dala. */
  popis: string | null;
};

export type AboVypis = {
  /** Číslo našeho účtu, ke kterému výpis patří. */
  ucet: string;
  nazevUctu: string | null;
  /** Pořadové číslo výpisu v roce - bance stačí k rozlišení. */
  cisloVypisu: string | null;
  datumVypisu: Date | null;
  pohyby: AboPohyb[];
};

/** Vyřízne pole a ořeže mezery; mimo řádek vrátí prázdno. */
function pole(radek: string, od: number, delka: number): string {
  return radek.slice(od, od + delka).trim();
}

/**
 * „ddmmrr" na datum. Dvouciferný rok bere jako 20xx - výpisy z minulého
 * století portál řešit nebude a 70 je bezpečná hranice.
 */
function datumZAbo(text: string): Date | null {
  if (!/^\d{6}$/.test(text)) return null;
  const den = Number(text.slice(0, 2));
  const mesic = Number(text.slice(2, 4));
  const rok2 = Number(text.slice(4, 6));
  if (den < 1 || den > 31 || mesic < 1 || mesic > 12) return null;
  const rok = rok2 < 70 ? 2000 + rok2 : 1900 + rok2;
  // Poledne v UTC schválně: datum se nikde nepřepočítává přes pásma a
  // půlnoc by se v Praze mohla posunout na předchozí den.
  return new Date(Date.UTC(rok, mesic - 1, den, 12, 0, 0));
}

/** Číslo bez vodících nul; samé nuly znamenají „nevyplněno". */
function cisloNeboNic(text: string): string | null {
  const bezNul = text.replace(/^0+/, '');
  return bezNul.length > 0 ? bezNul : null;
}

/**
 * KÓD ÚČTOVÁNÍ URČUJE ZNAMÉNKO. Částka je v ABO vždycky kladná, směr nese
 * tenhle jeden znak: 1 = debet (peníze pryč), 2 = kredit (přišly),
 * 4 a 5 jsou jejich storna, takže mají opačné znaménko.
 */
function znamenko(kod: string): number {
  if (kod === '2' || kod === '4') return 1;
  if (kod === '1' || kod === '5') return -1;
  return 1;
}

/** Protiúčet i s kódem banky, jak se u nás píše. Prázdný účet vrátí null. */
function protiucetSBankou(ucet: string, kodBanky: string): string | null {
  const cislo = cisloNeboNic(ucet);
  const banka = kodBanky.trim();
  if (!cislo) return null;
  return banka && banka !== '0000' ? `${cislo}/${banka}` : cislo;
}

/**
 * Rozebere celý výpis. Řádky, kterým nerozumí, tiše přeskočí - banky do
 * souborů přidávají vlastní doplňkové věty a kvůli nim nemá padat import.
 *
 * Když v souboru není ani jedna věta 075, vrátí `null`: to není výpis.
 */
export function rozeberAbo(obsah: string): AboVypis | null {
  const radky = obsah.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let ucet = '';
  let nazevUctu: string | null = null;
  let cisloVypisu: string | null = null;
  let datumVypisu: Date | null = null;
  const pohyby: AboPohyb[] = [];

  for (const radek of radky) {
    if (radek.length < 3) continue;
    const typ = radek.slice(0, 3);

    if (typ === '074') {
      ucet = cisloNeboNic(pole(radek, 3, 16)) ?? '';
      nazevUctu = pole(radek, 19, 20) || null;
      cisloVypisu = cisloNeboNic(pole(radek, 105, 3));
      datumVypisu = datumZAbo(pole(radek, 108, 6));
      continue;
    }

    if (typ !== '075') continue;

    const castkaText = pole(radek, 48, 12).replace(/\D/g, '');
    const castka = castkaText ? Number(castkaText) : 0;
    const datum = datumZAbo(pole(radek, 91, 6)) ?? datumVypisu ?? new Date();

    pohyby.push({
      cisloDokladu: pole(radek, 35, 13),
      castkaMinor: znamenko(pole(radek, 60, 1)) * castka,
      protiucet: protiucetSBankou(pole(radek, 19, 16), pole(radek, 75, 4)),
      variabilniSymbol: cisloNeboNic(pole(radek, 61, 10)),
      konstantniSymbol: cisloNeboNic(pole(radek, 71, 4)),
      specifickySymbol: cisloNeboNic(pole(radek, 81, 10)),
      datum,
      popis: pole(radek, 97, 20) || null,
    });
  }

  if (pohyby.length === 0) return null;
  return { ucet, nazevUctu, cisloVypisu, datumVypisu, pohyby };
}

/**
 * Jednoznačné označení pohybu, aby se tentýž výpis dal nahrát dvakrát a nic
 * se nezdvojilo.
 *
 * Číslo dokladu samo o sobě nestačí - banky ho v rámci roku recyklují -,
 * takže se přidává datum a částka. Dva pohyby, které se shodují ve všech
 * třech, jsou ve výpisu nerozlišitelné i pro člověka.
 */
export function oznacPohyb(ucet: string, p: AboPohyb): string {
  const den = p.datum.toISOString().slice(0, 10);
  return `abo:${ucet}:${den}:${p.cisloDokladu || 'bez-dokladu'}:${p.castkaMinor}`;
}
