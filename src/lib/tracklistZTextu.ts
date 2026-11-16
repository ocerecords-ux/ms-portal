import { bezDiakritiky, cisloTracku, nazevTrackuSMezerami } from '@/lib/tracklist';

/**
 * TRACKLIST Z TEXTU KNIHY - MODEL AUDIOTÉKY (zadání 30. 10. 2026: „tohle je
 * model, který se dělá u firmy Audiotéka. Pojďme to implementovat, že dáme
 * tlačítko generovat tracklist. Ale takto jen u Audiotéky").
 *
 * JEDEN TRACK = JEDNA KAPITOLA. Tracklist, který se u Audiotéky dělá ručně,
 * vzniká průchodem režijního textu: každá kapitola je jeden track, číslování
 * běží PRŮBĚŽNĚ CELOU KNIHOU (01-54) a v názvu tracku je kromě čísla i část
 * knihy, do které kapitola patří - u „Ve stínu jeřabiny" jsou to roky:
 *
 *   01_PROLOG
 *   02_1938 - KAPITOLA 1.
 *   …
 *   54_1940 - KAPITOLA 21.
 *
 * MEZERY V NÁZVU TU ZŮSTÁVAJÍ (upřesnění 30. 10. 2026: „ještě jsem upravil
 * vzor: 02_1938 - KAPITOLA 1."). Pomlčka místo mezery je naše pravidlo, ne
 * Audiotéky - viz nazevTrackuSMezerami v lib/tracklist.ts. Diakritika jde
 * pryč i tady: názvy tracků se stávají názvy souborů.
 *
 * KAPITOLY SE V KAŽDÉ ČÁSTI ČÍSLUJÍ ZNOVU od jedné (1938 má kapitoly 1-14,
 * 1939 taky od jedné), a právě proto je část v názvu: bez ní by v knize byly
 * tři „KAPITOLA 1." a soubory by si přepsaly jméno.
 *
 * TOHLE NENÍ NAČÍTÁNÍ TRACKLISTU ZE DISKU. Upřesnění z 15. 10. 2026
 * („nechci nikde načítat tracklist") mluvilo o soupisu HOTOVÝCH nahrávek -
 * tracklist je předpis, podle kterého se stopy teprve pojmenují. Tady se
 * nečte nic hotového: čte se PŘEDLOHA, tedy text knihy, ze kterého se předpis
 * stejně vypisuje - jen to za člověka udělá portál.
 *
 * NIC SE NEUKLÁDÁ SAMO. Funkce vrátí NÁVRH řádků; ty se nasypou do tabulky
 * v záložce Tracklist a uloží se teprve tím, kdo na to klikne. Generátor se
 * v nějaké knize spletl vždycky - na nadpisu, na obsahu na začátku - a
 * oprava před uložením je celý vtip.
 *
 * DLOUHÁ KAPITOLA SE ROZDĚLÍ NA ČÁSTI (zadání 16. 11. 2026: „samozřejmě
 * bude třeba i rozdělovat na části"). Kapitola delší než zadaný limit se
 * rozpadne na tolik stop, aby se do limitu vešly, a ke jménu se připíše
 * „- ČÁST 1.", „- ČÁST 2.". Dělí se na stejné díly - kde přesně se střihne,
 * stejně rozhoduje zvukař u pultu; tracklist jen říká, kolik stop té
 * kapitoly bude a jak se budou jmenovat.
 *
 * Měří se v normostranách (1 NS = 1800 znaků) z délky textu mezi dvěma
 * nadpisy, protože v normostranách se v portálu počítá všechno ostatní.
 * Limit 0 = nedělit.
 *
 * Soubor je BEZ PRISMY A BEZ pdf.js: text stránek sem chodí hotový
 * z prohlížeče (viz projekty/[id]/Tracklist.tsx), takže se tohle dá přečíst
 * i bez PDF v ruce.
 */

export type NavrhTracku = { nazevTracku: string; nazevKapitoly: string };

/**
 * ŘADOVÉ ČÍSLOVKY SLOVY. V knihách bývají kapitoly psané slovy („KAPITOLA
 * PRVNÍ"), ne číslicí - a v názvu tracku má být číslo. Klíče jsou bez
 * diakritiky a velkými, protože tak se porovnávají.
 */
const RADOVE: Record<string, number> = {
  PRVNI: 1,
  DRUHA: 2,
  TRETI: 3,
  CTVRTA: 4,
  PATA: 5,
  SESTA: 6,
  SEDMA: 7,
  OSMA: 8,
  DEVATA: 9,
  DESATA: 10,
  JEDENACTA: 11,
  DVANACTA: 12,
  TRINACTA: 13,
  CTRNACTA: 14,
  PATNACTA: 15,
  SESTNACTA: 16,
  SEDMNACTA: 17,
  OSMNACTA: 18,
  DEVATENACTA: 19,
  DVACATA: 20,
  TRICATA: 30,
  CTYRICATA: 40,
  PADESATA: 50,
};

/** Velká písmena včetně české diakritiky - nadpisy jsou verzálkami. */
const VELKA = 'A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ';

/**
 * „KAPITOLA PRVNÍ", „KAPITOLA\nDRUHÁ" i „KAPITOLA 12". Mezery se předem
 * srazí na jednu, takže je jedno, jestli je nadpis na jednom nebo dvou
 * řádcích - a to je u PDF hodně časté.
 */
const KAPITOLA = new RegExp(`KAPITOLA\\s+(\\d{1,3}|[${VELKA}]{3,}(?:\\s+[${VELKA}]{3,})?)`, 'g');

/**
 * OPAČNÉ POŘADÍ - „1. KAPITOLA", „PRVNÍ KAPITOLA". Takhle je sázená třeba
 * předloha Kluků jako my; bez tohohle vzoru by generátor v celé knize
 * nenašel ani jednu kapitolu.
 *
 * ČÍSLICE TU MUSÍ MÍT TEČKU („1. KAPITOLA"). Bez ní by se vzor chytil na
 * číslo stránky, které v PDF často stojí těsně před nadpisem - a z „106
 * KAPITOLA PRVNÍ" by byla kapitola 106.
 */
const KAPITOLA_PRED = new RegExp(
  `(\\d{1,3}\\.|[${VELKA}]{3,}(?:\\s+[${VELKA}]{3,})?)\\s+KAPITOLA`,
  'g',
);

/** Části knihy, které kapitola nejsou a track mají (prolog, epilog…). */
const MIMO_KAPITOLY = /\b(PROLOG|EPILOG|PŘEDMLUVA|PREDMLUVA|DOSLOV|PROLOGUE|EPILOGUE)\b/g;

/** Rok jako část knihy - „1938". Stránkování je nejvýš trojmístné, nepleteme se. */
const ROK = /\b(1[5-9]\d\d|20\d\d)\b/g;

/**
 * Jak blízko před nadpisem musí rok stát, aby to byl ROZDĚLNÍK ČÁSTI, a ne
 * jen rok ve větě. V předloze je na stránce samotný: „ČTE LUBOŠ 1938 KAPITOLA
 * PRVNÍ". Vypravěčská hlavička před ním se vejde, odstavec textu ne.
 */
const ROK_BLIZKO = 60;

/** „PRVNÍ" → 1, „DVACÁTÁ PRVNÍ" → 21, „12" → 12. */
export function cisloKapitoly(slovo: string): number | null {
  const text = bezDiakritiky(slovo).toUpperCase().trim();
  if (/^\d{1,3}$/.test(text)) {
    const cislo = Number(text);
    return cislo > 0 ? cislo : null;
  }
  const kusy = text.split(/\s+/).filter(Boolean);
  const prvni = RADOVE[kusy[0]];
  if (prvni === undefined) return null;
  const druhe = kusy.length > 1 ? RADOVE[kusy[1]] : undefined;
  // Desítky se sčítají jen s jednotkami: „dvacátá první" = 21, ale „první
  // druhá" (dvě nesouvisející slova za sebou) zůstane jedničkou.
  if (prvni >= 20 && prvni % 10 === 0 && druhe !== undefined && druhe < 10) return prvni + druhe;
  return prvni;
}

/**
 * NÁZEV STOPY PODLE ODEVZDANÉ KNIHY (vzorek z 16. 11. 2026:
 * `01 NEJVETSI PODVODNIK PRVNI REPUBLIKY, Cast 1.mp3`).
 *
 * Pořadí, MEZERA a zbytek VELKÝMI PÍSMENY BEZ DIAKRITIKY. Podtržítko za
 * číslem je náš tvar (`01_NAZEV-KNIHY` u ručního založení), Audiotéka
 * odevzdává s mezerou - přečíslování v lib/tracklist.ts zvládá obojí.
 */
function velkyNazev(poradi: string, zbytek: string, dil = ''): string {
  return `${poradi} ${nazevTrackuSMezerami(zbytek).toUpperCase()}${dil}`;
}

/** „PROLOG" → „Prolog" - do názvu kapitoly, ne do názvu souboru. */
function velkeNaMale(text: string): string {
  const cely = text.trim();
  return cely.slice(0, 1).toUpperCase() + cely.slice(1).toLowerCase();
}

/** Jedna normostrana. Stejné měřítko jako jinde v portálu. */
const ZNAKU_NA_NORMOSTRANU = 1800;

/** Když se limit nezadá: kapitola nad patnáct normostran se dělí. */
export const VYCHOZI_LIMIT_NORMOSTRAN = 15;

export type MoznostiNavrhu = {
  /**
   * Nejdelší stopa v normostranách. 0 (nebo záporné) = nedělit, každá
   * kapitola zůstane jednou stopou, ať je jakkoli dlouhá.
   */
  maxNormostran?: number;
};

type Znacka =
  | { typ: 'mimo'; nadpis: string; titul: string | null; poz: number }
  | { typ: 'kapitola'; cislo: number; cast: string | null; titul: string | null; poz: number };

/**
 * NÁZEV KAPITOLY ZA NADPISEM (zadání 16. 11. 2026: „u Audiotéky je to bez
 * diakritiky a velkými písmeny: 01_KAPITOLA 1 - NÁZEV KAPITOLY").
 *
 * Kapitola mívá pod číslem ještě vlastní název - u Kluků jako my je to den
 * v týdnu („1. KAPITOLA / PONDĚLÍ"). Sází se verzálkami, takže se bere jen
 * to, co hned za nadpisem pokračuje VELKÝMI PÍSMENY; první slovo psané
 * normálně je už text kapitoly a tam se čtení zastaví.
 *
 * KDO ČTE SE NEBERE (upřesnění z téhož dne: „kdo co čte do tracklistu
 * nepatří") - řádek „ČTE HYNEK" je verzálkami taky, a kdyby stál za
 * nadpisem, spletl by se s názvem.
 */
const TITUL = new RegExp(`^\\s*((?:[${VELKA}]{2,}\\s+){0,3}[${VELKA}]{2,})(?![${VELKA}])`);

function titulKapitoly(text: string, od: number): string | null {
  const shoda = TITUL.exec(text.slice(od, od + 80));
  const nalezeny = shoda?.[1]?.trim();
  if (!nalezeny) return null;
  if (/^(ČTE|CTE|KAPITOLA)\b/u.test(nalezeny)) return null;
  return nalezeny;
}

/** Na kolik stop se nadpis dlouhý `znaku` rozpadne. */
function pocetCasti(znaku: number, maxNormostran: number): number {
  if (maxNormostran <= 0) return 1;
  const limit = maxNormostran * ZNAKU_NA_NORMOSTRANU;
  if (!Number.isFinite(znaku) || znaku <= limit) return 1;
  return Math.ceil(znaku / limit);
}

type Nalez = { poz: number; konec: number; nadpis: string | null; cislo: number | null };

/**
 * TÝŽ NADPIS NAJDOU OBA VZORY. „1. KAPITOLA PONDĚLÍ" sedí na KAPITOLA_PRED
 * (číslo před slovem) a zároveň na KAPITOLA, která si za slovem přečte
 * „PONDĚLÍ" - a z názvu kapitoly by se tak stala další kapitola navíc.
 *
 * Z překrývajících se nálezů proto zůstane JEN JEDEN: ten, u kterého se dá
 * číslo opravdu přečíst. Když se to nepovede ani u jednoho, zůstane první -
 * číslo se pak dopočítá z pořadí, jak to bylo i dřív.
 */
function bezPrekryvu(nalezy: Nalez[]): Nalez[] {
  const jiste = (n: Nalez) => n.nadpis !== null || n.cislo !== null;
  const vybrane: Nalez[] = [];
  for (const nalez of nalezy) {
    const predchozi = vybrane[vybrane.length - 1];
    if (predchozi && nalez.poz < predchozi.konec) {
      if (!jiste(predchozi) && jiste(nalez)) vybrane[vybrane.length - 1] = nalez;
      continue;
    }
    vybrane.push(nalez);
  }
  return vybrane;
}

/**
 * NÁVRH TRACKŮ Z TEXTU STRÁNEK. Na vstupu je text knihy po stránkách
 * (stránky se nikde nevypisují, slouží jen k tomu, že se nadpis nehledá
 * přes celou knihu najednou a pořadí vyjde správně).
 *
 * KAŽDÁ KAPITOLA SE BERE JEN JEDNOU. Knihy mívají na začátku obsah, kde jsou
 * nadpisy podruhé; druhý výskyt téže kapitoly v téže části se proto zahodí.
 * Když nadpis kapitole chybí nebo je napsaný tak, že se číslo nedá přečíst,
 * pokračuje se od posledního čísla - lepší než vynechaná stopa.
 *
 * KDO CO ČTE SE NEBERE (upřesnění 16. 11. 2026: „kdo co čte do tracklistu
 * nepatří"). Předlohy pro dva herce mají nad nadpisy řádky „ČTE HYNEK",
 * „ČTE JOSEF"; generátor si jich nevšímá a tracky číslu je průběžně celou
 * knihou, bez ohledu na to, kdo kterou kapitolu čte.
 */
export function navrhniTracky(stranky: string[], moznosti: MoznostiNavrhu = {}): NavrhTracku[] {
  const maxNormostran = moznosti.maxNormostran ?? VYCHOZI_LIMIT_NORMOSTRAN;
  const znacky: Znacka[] = [];
  const videne = new Set<string>();
  let cast: string | null = null;
  let posledni = 0;
  /** Kolik znaků knihy už je za námi - kvůli délce kapitoly. */
  let zacatek = 0;

  for (const strana of stranky) {
    const text = (strana || '').replace(/\s+/g, ' ');
    if (!text.trim()) {
      zacatek += 1;
      continue;
    }

    const roky = Array.from(text.matchAll(ROK)).map((m) => ({ poz: m.index ?? 0, rok: m[1] }));
    const vsechny: Nalez[] = [];
    for (const m of text.matchAll(MIMO_KAPITOLY)) {
      const poz = m.index ?? 0;
      vsechny.push({ poz, konec: poz + m[0].length, nadpis: m[1] ?? null, cislo: null });
    }
    for (const m of text.matchAll(KAPITOLA)) {
      const poz = m.index ?? 0;
      vsechny.push({ poz, konec: poz + m[0].length, nadpis: null, cislo: cisloKapitoly(m[1] ?? '') });
    }
    for (const m of text.matchAll(KAPITOLA_PRED)) {
      const poz = m.index ?? 0;
      // Tečka za číslicí je jen oddělovač, do čísla kapitoly nepatří.
      const slovo = (m[1] ?? '').replace(/\.$/, '');
      vsechny.push({ poz, konec: poz + m[0].length, nadpis: null, cislo: cisloKapitoly(slovo) });
    }
    vsechny.sort((a, b) => a.poz - b.poz);
    const nalezy = bezPrekryvu(vsechny);

    for (const nalez of nalezy) {
      // Rok těsně před nadpisem = nová část knihy. Platí pak i pro další
      // kapitoly, které už rok na stránce nemají.
      const blizky = roky.filter((r) => r.poz < nalez.poz && nalez.poz - r.poz <= ROK_BLIZKO).pop();
      if (blizky && blizky.rok !== cast) {
        cast = blizky.rok;
        // V nové části se kapitoly číslují znovu od jedné.
        posledni = 0;
      }

      const poz = zacatek + nalez.poz;

      if (nalez.nadpis) {
        const klic = `mimo|${bezDiakritiky(nalez.nadpis).toUpperCase()}`;
        if (videne.has(klic)) continue;
        videne.add(klic);
        znacky.push({
          typ: 'mimo',
          nadpis: nalez.nadpis,
          titul: titulKapitoly(text, nalez.konec),
          poz,
        });
        continue;
      }

      const cislo = nalez.cislo ?? posledni + 1;
      const klic = `kap|${cast ?? ''}|${cislo}`;
      if (videne.has(klic)) continue;
      videne.add(klic);
      posledni = cislo;
      znacky.push({ typ: 'kapitola', cislo, cast, titul: titulKapitoly(text, nalez.konec), poz });
    }

    zacatek += text.length + 1;
  }

  /**
   * DÉLKA JEDNOHO NADPISU = text až k dalšímu nadpisu. Oba vzory kapitol
   * můžou najít tentýž nadpis dvakrát; druhý výskyt už je zahozený výš,
   * takže pozice jdou po sobě.
   */
  const rozepsane = znacky.flatMap((z, i) => {
    const konec = i + 1 < znacky.length ? znacky[i + 1]!.poz : zacatek;
    const casti = pocetCasti(konec - z.poz, maxNormostran);
    return Array.from({ length: casti }, (_, k) => ({
      znacka: z,
      cast: casti > 1 ? k + 1 : null,
    }));
  });

  return rozepsane.map((r, i) => {
    const poradi = cisloTracku(i + 1);
    /**
     * DÍL SE PŘIPISUJE ČÁRKOU (vzorek: `…PRVNI REPUBLIKY, Cast 1`). „Cast"
     * je velkým jen na začátku, i když zbytek názvu je verzálkami - tak to
     * Audiotéka odevzdává, proto se nepřepisuje spolu s ním.
     */
    const dil = r.cast ? `, Cast ${r.cast}` : '';
    const dilSlovy = r.cast ? `, Část ${r.cast}` : '';

    if (r.znacka.typ === 'mimo') {
      const nazev = r.znacka.titul ? ` - ${r.znacka.titul}` : '';
      return {
        nazevTracku: velkyNazev(poradi, `${r.znacka.nadpis}${nazev}`, dil),
        nazevKapitoly: [
          velkeNaMale(r.znacka.nadpis),
          r.znacka.titul ? ` - ${velkeNaMale(r.znacka.titul)}` : '',
          dilSlovy,
        ].join(''),
      };
    }

    const rok = r.znacka.cast ? `${r.znacka.cast} - ` : '';
    const titul = r.znacka.titul ? ` - ${r.znacka.titul}` : '';
    return {
      nazevTracku: velkyNazev(poradi, `${rok}KAPITOLA ${r.znacka.cislo}${titul}`, dil),
      nazevKapitoly: [
        r.znacka.cast ? `${r.znacka.cast}, ` : '',
        `Kapitola ${r.znacka.cislo}`,
        r.znacka.titul ? ` - ${velkeNaMale(r.znacka.titul)}` : '',
        dilSlovy,
      ].join(''),
    };
  });
}
