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

/** „PROLOG" → „Prolog" - do názvu kapitoly, ne do názvu souboru. */
function velkeNaMale(text: string): string {
  const cely = text.trim();
  return cely.slice(0, 1).toUpperCase() + cely.slice(1).toLowerCase();
}

type Znacka =
  | { typ: 'mimo'; nadpis: string }
  | { typ: 'kapitola'; cislo: number; cast: string | null };

/**
 * NÁVRH TRACKŮ Z TEXTU STRÁNEK. Na vstupu je text knihy po stránkách
 * (stránky se nikde nevypisují, slouží jen k tomu, že se nadpis nehledá
 * přes celou knihu najednou a pořadí vyjde správně).
 *
 * KAŽDÁ KAPITOLA SE BERE JEN JEDNOU. Knihy mívají na začátku obsah, kde jsou
 * nadpisy podruhé; druhý výskyt téže kapitoly v téže části se proto zahodí.
 * Když nadpis kapitole chybí nebo je napsaný tak, že se číslo nedá přečíst,
 * pokračuje se od posledního čísla - lepší než vynechaná stopa.
 */
export function navrhniTracky(stranky: string[]): NavrhTracku[] {
  const znacky: Znacka[] = [];
  const videne = new Set<string>();
  let cast: string | null = null;
  let posledni = 0;

  for (const strana of stranky) {
    const text = (strana || '').replace(/\s+/g, ' ');
    if (!text.trim()) continue;

    const roky = Array.from(text.matchAll(ROK)).map((m) => ({ poz: m.index ?? 0, rok: m[1] }));
    const nalezy: { poz: number; slovo: string | null; nadpis: string | null }[] = [];
    for (const m of text.matchAll(MIMO_KAPITOLY)) {
      nalezy.push({ poz: m.index ?? 0, slovo: null, nadpis: m[1] });
    }
    for (const m of text.matchAll(KAPITOLA)) {
      nalezy.push({ poz: m.index ?? 0, slovo: m[1], nadpis: null });
    }
    nalezy.sort((a, b) => a.poz - b.poz);

    for (const nalez of nalezy) {
      // Rok těsně před nadpisem = nová část knihy. Platí pak i pro další
      // kapitoly, které už rok na stránce nemají.
      const blizky = roky.filter((r) => r.poz < nalez.poz && nalez.poz - r.poz <= ROK_BLIZKO).pop();
      if (blizky && blizky.rok !== cast) {
        cast = blizky.rok;
        // V nové části se kapitoly číslují znovu od jedné.
        posledni = 0;
      }

      if (nalez.nadpis) {
        const klic = `mimo|${bezDiakritiky(nalez.nadpis).toUpperCase()}`;
        if (videne.has(klic)) continue;
        videne.add(klic);
        znacky.push({ typ: 'mimo', nadpis: nalez.nadpis });
        continue;
      }

      const cislo = cisloKapitoly(nalez.slovo ?? '') ?? posledni + 1;
      const klic = `kap|${cast ?? ''}|${cislo}`;
      if (videne.has(klic)) continue;
      videne.add(klic);
      posledni = cislo;
      znacky.push({ typ: 'kapitola', cislo, cast });
    }
  }

  return znacky.map((z, i) => {
    const poradi = cisloTracku(i + 1);
    if (z.typ === 'mimo') {
      return {
        nazevTracku: `${poradi}_${nazevTrackuSMezerami(z.nadpis)}`,
        nazevKapitoly: velkeNaMale(z.nadpis),
      };
    }
    const cast = z.cast ? `${z.cast} - ` : '';
    return {
      // Tečka na konci je ze vzoru Audiotéky („…KAPITOLA 1.").
      nazevTracku: `${poradi}_${nazevTrackuSMezerami(`${cast}KAPITOLA ${z.cislo}.`)}`,
      nazevKapitoly: z.cast ? `${z.cast}, Kapitola ${z.cislo}.` : `Kapitola ${z.cislo}.`,
    };
  });
}
