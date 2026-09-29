/**
 * ČTENÍ UPOZORNĚNÍ Z BANKY O POHYBU NA ÚČTU (29. 9. 2026).
 *
 * PROČ TAHLE CESTA. Párování má běžet samo a hned, ne z ručně staženého
 * souboru. Na API banky ale nedosáhneme: Air Bank má AIS/PIS podle Czech Open
 * Banking Standardu a pustí k němu jen firmu s licencí ČNB a eIDAS
 * certifikátem. Prostředníci buď neberou nové zákazníky (GoCardless), nebo
 * Česko nepokrývají (Enable Banking), nebo se platí.
 *
 * Zbývá to, co u nás používají e-shopy i fakturační služby: banka umí při
 * každé změně zůstatku poslat e-mail a ten nese všechno, co párování
 * potřebuje - částku, variabilní symbol i protistranu. Portál do schránky
 * kouká každé dvě minuty, takže faktura je označená jako uhrazená dřív, než si
 * toho kdokoliv všimne.
 *
 * TENHLE SOUBOR JE JEN PŘEKLAD TEXTU NA ČÍSLA - bez Prismy a bez sítě, ať jde
 * otestovat samostatně. Stahování ze schránky sedí v bankaMailServer.ts.
 *
 * ČTE SE SCHVÁLNĚ VOLNĚ. Banka nikde nezveřejňuje, jak přesně e-mail vypadá,
 * a znění si časem mění. Proto se tu nehledají pevné pozice ani celé věty, ale
 * štítky („variabilní symbol", „částka") a slova označující směr. Co se
 * přečíst nepovede, portál zahodí a řekne o tom - `rozeberMailOPohybu` v
 * takovém případě vrací `null`. Radši nic než vymyšlená částka.
 *
 * HLEDÁ SE V TEXTU BEZ DIAKRITIKY. Jinak by každý štítek musel mít v sobě
 * „[čc]" a „[íi]" a stačilo by jedno opomenutí, aby se „Protiúčet" nenašel
 * a portál sáhl po prvním čísle účtu v textu - což je ten náš. Hodnoty se
 * pak berou z původního textu podle pozic, takže jména protistran zůstávají
 * s háčky.
 */

export type ZpravaOPohybu = {
  /** Číslo účtu, kterého se pohyb týká - když ho e-mail neuvádí, null. */
  ucet: string | null;
  /** Kladná částka = peníze přišly, záporná = odešly. V haléřích. */
  castkaMinor: number;
  /** Kód měny, jak stál v e-mailu („CZK"). */
  mena: string;
  variabilniSymbol: string | null;
  specifickySymbol: string | null;
  konstantniSymbol: string | null;
  protiucet: string | null;
  protistrana: string | null;
  /** Zpráva pro příjemce nebo poznámka, pokud ji banka uvádí. */
  zprava: string | null;
};

/**
 * Text ve dvou podobách: v jaké se hledá a v jaké se čtou hodnoty.
 *
 * Obě mají stejnou délku, protože odstranění diakritiky u češtiny jeden znak
 * zase na jeden znak vrací. Kdyby se to u nějakého zvláštního znaku rozešlo,
 * vezme se i pro hodnoty text bez diakritiky - horší výsledek, ale pořád
 * správné číslo.
 */
type Text = { puvodni: string; hledaci: string };

function narovnej(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[‐-―]/g, '-')
    .replace(/[ \t]+/g, ' ');
}

function pripravText(surovy: string): Text {
  const puvodni = narovnej(surovy);
  const hledaci = puvodni.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return hledaci.length === puvodni.length ? { puvodni, hledaci } : { puvodni: hledaci, hledaci };
}

/**
 * „1 234,50" na haléře. Tisíce oddělené mezerou i tečkou, desetiny čárkou
 * i tečkou - banky to píšou různě a na obojí se dá narazit i v jednom e-mailu.
 */
export function castkaNaMinor(text: string | null | undefined): number | null {
  if (!text) return null;
  const ocistene = text.trim().replace(/\s/g, '');
  if (!/^-?\d[\d.,]*$/.test(ocistene)) return null;

  // Poslední oddělovač, za kterým stojí jedna nebo dvě číslice, je desetinná
  // čárka; cokoliv jiného odděluje tisíce a zahazuje se.
  const posledni = Math.max(ocistene.lastIndexOf(','), ocistene.lastIndexOf('.'));
  const zaNim = posledni >= 0 ? ocistene.length - posledni - 1 : 0;
  const maDesetiny = posledni >= 0 && zaNim >= 1 && zaNim <= 2;

  const cele = (maDesetiny ? ocistene.slice(0, posledni) : ocistene).replace(/[.,]/g, '');
  const zbytek = maDesetiny ? ocistene.slice(posledni + 1).padEnd(2, '0') : '00';

  const cislo = Number(`${cele || '0'}.${zbytek}`);
  return Number.isFinite(cislo) ? Math.round(cislo * 100) : null;
}

/**
 * Hodnota za štítkem. Štítek musí stát jako samostatné slovo, jinak by se
 * „od" našlo uvnitř „Odesílatel" a vrátilo by „esílatel: …".
 */
function zaStitkem(t: Text, stitek: string): string | null {
  const hledej = new RegExp(
    `(?:^|[^A-Za-z0-9])(?:${stitek})(?![A-Za-z0-9])\\s*[:\\-]?\\s*([^\\n]{1,120})`,
    'id',
  );
  const shoda = t.hledaci.match(hledej);
  const misto = shoda?.indices?.[1];
  if (!shoda || !misto) return null;
  const hodnota = t.puvodni.slice(misto[0], misto[1]).trim().replace(/[.,;]+$/, '');
  return hodnota || null;
}

/** První štítek ze seznamu, který se v textu najde. Pořadí je priorita. */
function zaPrvnimStitkem(t: Text, stitky: string[]): string | null {
  for (const stitek of stitky) {
    const hodnota = zaStitkem(t, stitek);
    if (hodnota) return hodnota;
  }
  return null;
}

/** Jen číslice ze štítku; prázdné a samé nuly bere jako nevyplněné. */
function cisloZaStitkem(t: Text, stitky: string[]): string | null {
  const hodnota = zaPrvnimStitkem(t, stitky);
  if (!hodnota) return null;
  const cislice = (hodnota.match(/\d[\d ]*/)?.[0] ?? '').replace(/\s/g, '').replace(/^0+/, '');
  return cislice || null;
}

/** Kód měny v textu. Bez nálezu se bere koruna. */
function menaZTextu(text: string): string {
  if (/\b(Kc|CZK)\b/i.test(text)) return 'CZK';
  if (/(\bEUR\b|€)/i.test(text)) return 'EUR';
  if (/(\bUSD\b|\$)/.test(text)) return 'USD';
  if (/(\bGBP\b|£)/.test(text)) return 'GBP';
  return 'CZK';
}

/** Slova, za kterými následuje částka, co na účet přibyla. */
const PRICHOZI = '(?:pripsal\\w*|pripsan\\w*|prisl\\w*|pribylo|vzrostl\\w*|zvysil\\w*|navysil\\w*|kredit|prichozi)';
/** A ta, za kterými následuje částka, co ubyla. */
const ODCHOZI = '(?:odepsal\\w*|odeslal\\w*|ubylo|klesl\\w*|snizil\\w*|debet|odchozi|zaplatili jste|poslali jsme)';

const CISLO = String.raw`-?\d[\d .,]*\d|\d`;
const MENA = String.raw`(?:Kc|CZK|EUR|€|USD|\$|GBP|£)`;

/**
 * Najde částku pohybu a její znaménko.
 *
 * NEJTĚŽŠÍ JE NESPLÉST SI JI SE ZŮSTATKEM. E-mail o změně zůstatku nese
 * obvykle obě čísla a to větší z nich je skoro vždycky zůstatek, ne platba.
 * Proto se bere přednostně částka za štítkem „částka" nebo hned za slovem
 * o směru („připsali jsme vám 31 200 Kč") a všechno, co se váže na slovo
 * zůstatek, se přeskakuje.
 */
function najdiCastku(t: Text): { minor: number; mena: string } | null {
  const kandidati: { hodnota: string; okoli: string }[] = [];

  const zeStitku = zaPrvnimStitkem(t, ['castka prevodu', 'castka platby', 'castka']);
  if (zeStitku) kandidati.push({ hodnota: zeStitku, okoli: zeStitku });

  const poSmeru = t.hledaci.match(
    new RegExp(`(?:${PRICHOZI}|${ODCHOZI})[^\\n]{0,60}?(${CISLO})\\s*(${MENA})`, 'i'),
  );
  if (poSmeru) kandidati.push({ hodnota: poSmeru[1], okoli: poSmeru[0] });

  for (const nalez of t.hledaci.matchAll(new RegExp(`(${CISLO})\\s*(${MENA})`, 'gi'))) {
    const pred = t.hledaci.slice(Math.max(0, (nalez.index ?? 0) - 40), nalez.index);
    if (/zustatek|k dispozici|disponibiln/i.test(pred)) continue;
    kandidati.push({ hodnota: nalez[1], okoli: `${pred}${nalez[0]}` });
    break;
  }

  // Znaménko se bere z celého textu, ne jen z okolí čísla - „přišla vám
  // platba" může stát o odstavec výš než samotná částka.
  const kladne = new RegExp(PRICHOZI, 'i').test(t.hledaci);
  const zaporne = new RegExp(ODCHOZI, 'i').test(t.hledaci);
  const znamenko = kladne ? 1 : zaporne ? -1 : 1;

  for (const kandidat of kandidati) {
    const minor = castkaNaMinor(kandidat.hodnota);
    if (minor === null || minor === 0) continue;
    return { minor: Math.abs(minor) * znamenko, mena: menaZTextu(kandidat.okoli) || menaZTextu(t.hledaci) };
  }
  return null;
}

/**
 * Číslo účtu z hodnoty za štítkem.
 *
 * MUSÍ STÁT HNED ZA ŠTÍTKEM. Bez toho by věta „z účtu jsme odepsali 1 500 Kč
 * ve prospěch účtu 987654321/0800" vydala za náš účet ten cizí, protože by se
 * po štítku „z účtu" vzalo první číslo, které se v řádku objeví.
 */
const ODSTUP_UCTU = 30;

function ucetZHodnoty(hodnota: string | null): string | null {
  if (!hodnota) return null;
  const blizko = (shoda: RegExpMatchArray | null) =>
    shoda && (shoda.index ?? 0) <= ODSTUP_UCTU ? shoda[1].replace(/\s/g, '') : null;

  return (
    blizko(hodnota.match(/((?:\d{1,6}-)?\d{2,10}\s*\/\s*\d{4})/)) ??
    blizko(hodnota.match(/\b([A-Z]{2}\d{2}[A-Z0-9 ]{10,32})\b/)) ??
    blizko(hodnota.match(/\b(\d{6,10})\b/))
  );
}

/**
 * Účet za prvním štítkem, který ho nese. Číslo s kódem banky má přednost před
 * holým - předmět e-mailu často uvádí jen „účet 2901234567", zatímco v těle
 * stojí celé „2901234567/3030".
 */
function ucetZaStitky(t: Text, stitky: string[]): string | null {
  let holy: string | null = null;
  for (const stitek of stitky) {
    const ucet = ucetZHodnoty(zaStitkem(t, stitek));
    if (!ucet) continue;
    if (ucet.includes('/') || /^[A-Z]{2}\d/.test(ucet)) return ucet;
    holy ??= ucet;
  }
  return holy;
}

/**
 * Rozebere e-mail o pohybu na účtu.
 *
 * Vrací `null`, když v textu není rozpoznatelná částka - takový e-mail není
 * upozornění na pohyb (reklama z banky, potvrzení o přihlášení) nebo má znění,
 * které zatím neumíme. Volající si ho poznamená, ať je vidět, že něco přišlo
 * a nezpracovalo se.
 */
export function rozeberMailOPohybu(predmet: string, telo: string): ZpravaOPohybu | null {
  const t = pripravText(`${predmet}\n${telo}`);

  const castka = najdiCastku(t);
  if (!castka) return null;

  return {
    // „Náš" účet: schválně až po protiúčtu v pořadí štítků, ať se nezamění.
    ucet: ucetZaStitky(t, ['na uctu', 'na ucet', 'ucet cislo', 'vas ucet', 'uctu', 'ucet']),
    castkaMinor: castka.minor,
    mena: castka.mena,
    variabilniSymbol: cisloZaStitkem(t, ['variabilni symbol', 'variabilniho symbolu', 'VS']),
    specifickySymbol: cisloZaStitkem(t, ['specificky symbol', 'SS']),
    konstantniSymbol: cisloZaStitkem(t, ['konstantni symbol', 'KS']),
    protiucet: ucetZaStitky(t, [
      'protiucet',
      'protiuctu',
      'cislo uctu odesilatele',
      've prospech uctu',
      'z uctu',
    ]),
    protistrana:
      zaPrvnimStitkem(t, ['nazev protistrany', 'odesilatel', 'platce', 'prijemce', 'protistrana', 'od'])?.slice(
        0,
        200,
      ) ?? null,
    zprava:
      zaPrvnimStitkem(t, ['zprava pro prijemce', 'zprava prijemci', 'poznamka', 'popis'])?.slice(0, 300) ?? null,
  };
}

/**
 * Jednoznačné označení pohybu z e-mailu.
 *
 * Bere se identifikátor zprávy, protože banka na každý pohyb pošle právě jeden
 * e-mail a ten má vlastní Message-ID. Kdyby se schránka četla dvakrát, pohyb
 * se nezdvojí. Proti témuž pohybu, který přijde ještě jednou ve staženém
 * výpisu, chrání kontrola v `ulozAZparuj`: shodné datum, částka a variabilní
 * symbol znamenají tentýž pohyb bez ohledu na to, odkud se portál dozvěděl.
 */
export function oznacMail(messageId: string): string {
  return `mail:${messageId}`.slice(0, 300);
}
