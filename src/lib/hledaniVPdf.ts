/**
 * HLEDÁNÍ V TEXTU PDF (zadání 21. 9. 2026: „v PDF bych chtěl
 * sofistikovanější vyhledávání slov").
 *
 * Co to umí navíc proti obyčejnému Ctrl+F v prohlížeči (které v AudioTaggeru
 * stejně nefunguje - stránky se kreslí, až když se k nim doroluje):
 *
 *  - hledá v CELÉM textu, i na stránkách, které ještě nejsou vykreslené,
 *  - BEZ OHLEDU NA DIAKRITIKU A VELIKOST PÍSMEN („prilis" najde „Příliš"),
 *    dá se to přepnout na přesné,
 *  - najde i slovo ROZDĚLENÉ NA KONCI ŘÁDKU („roz-\nhodl" = „rozhodl")
 *    a frázi přes konec řádku,
 *  - jen CELÁ SLOVA („les" nenajde „lesník"),
 *  - PŘIBLIŽNĚ - slovo s překlepem nebo jiným tvarem o písmeno („Novák"
 *    najde „Nováka", „Novak", „Nobák"); u přeposlechu se hodí, když herec
 *    přečetl něco jinak a člověk to hledá podle sluchu.
 *
 * Soubor nesahá na pdf.js ani na DOM - dostane položky textu stránky a jejich
 * polohu, vrátí nálezy i s obdélníky ve zlomcích strany (stejně jako
 * zvýraznění chyb). Dá se tak vyzkoušet i bez prohlížeče.
 */

/** Jedna položka textu ze stránky (z getTextContent). Poloha ve zlomcích strany. */
export type PolozkaTextu = {
  str: string;
  /** Konec řádku za položkou. */
  hasEOL?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type StrankaTextu = { strana: number; polozky: PolozkaTextu[] };

/** Připravený text strany: normalizovaný řetězec a odkud se který znak vzal. */
type Pripravena = {
  strana: number;
  text: string;
  /** Pro každý znak `text`: index položky a znak v ní; -1 = doplněná mezera. */
  zdroj: { polozka: number; znak: number }[];
  polozky: PolozkaTextu[];
};

export type MoznostiHledani = {
  /** Rozlišovat diakritiku a velikost písmen. */
  presne?: boolean;
  /** Jen celá slova. */
  celaSlova?: boolean;
  /** Připustit překlep / jiný tvar slova. */
  pribizne?: boolean;
};

export type Nalez = {
  strana: number;
  /** Úryvek kolem nálezu - `pred`, `nalez`, `po`, už v původním znění. */
  pred: string;
  nalez: string;
  po: string;
  /** Obdélníky [x, y, šířka, výška] ve zlomcích strany. */
  ramecky: [number, number, number, number][];
};

/** Jeden znak bez diakritiky a malým písmenem (vždy zase jeden znak). */
function zakladZnaku(z: string, presne: boolean): string {
  if (presne) return z;
  const bez = z.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (bez || z).charAt(0).toLowerCase();
}

export function normalizujDotaz(dotaz: string, presne: boolean): string {
  return Array.from(dotaz.trim().replace(/\s+/g, ' '))
    .map((z) => zakladZnaku(z, presne))
    .join('');
}

const JE_PISMENO = /[\p{L}\p{N}]/u;

/**
 * Text strany pro hledání. Položky se spojují; na konci řádku se dá mezera,
 * a když řádek končí spojovníkem uprostřed slova, spojovník se vynechá
 * a slovo se spojí (rozdělení slova na dva řádky).
 */
export function pripravStranu(s: StrankaTextu, presne: boolean): Pripravena {
  const znaky: string[] = [];
  const zdroj: Pripravena['zdroj'] = [];
  const pridej = (z: string, polozka: number, znak: number) => {
    const n = zakladZnaku(z, presne);
    // Vice mezer za sebou = jedna (PDF je sklada ruzne).
    if (/\s/.test(n)) {
      if (znaky.length === 0 || znaky[znaky.length - 1] === ' ') return;
      znaky.push(' ');
    } else {
      znaky.push(n);
    }
    zdroj.push({ polozka, znak });
  };

  s.polozky.forEach((p, i) => {
    const str = p.str ?? '';
    const dalsi = s.polozky[i + 1]?.str ?? '';
    const rozdeleni = p.hasEOL && /[\p{L}]-$/u.test(str) && JE_PISMENO.test(dalsi.charAt(0));
    const delka = rozdeleni ? str.length - 1 : str.length;
    for (let k = 0; k < delka; k += 1) pridej(str[k], i, k);
    if (p.hasEOL && !rozdeleni) pridej(' ', i, -1);
  });

  return { strana: s.strana, text: znaky.join(''), zdroj, polozky: s.polozky };
}

/** Levenshteinova vzdálenost s horní mezí (nad ní se dál nepočítá). */
export function vzdalenost(a: string, b: string, strop: number): number {
  if (Math.abs(a.length - b.length) > strop) return strop + 1;
  let pred = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const ted = [i];
    let nejmensi = i;
    for (let j = 1; j <= b.length; j += 1) {
      const v = Math.min(pred[j] + 1, ted[j - 1] + 1, pred[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ted.push(v);
      if (v < nejmensi) nejmensi = v;
    }
    if (nejmensi > strop) return strop + 1;
    pred = ted;
  }
  return pred[b.length];
}

/** Kolik překlepů se u slova té délky toleruje. Krátká slova musí sedět. */
function tolerance(delka: number): number {
  if (delka <= 3) return 0;
  if (delka <= 7) return 1;
  return 2;
}

/** Úseky [od, do) v textu strany, které dotazu odpovídají. */
export function najdiVTextu(text: string, dotaz: string, m: MoznostiHledani): [number, number][] {
  if (!dotaz) return [];
  const vysledek: [number, number][] = [];

  if (!m.pribizne) {
    let od = 0;
    for (;;) {
      const i = text.indexOf(dotaz, od);
      if (i < 0) break;
      const konec = i + dotaz.length;
      const okraj = !m.celaSlova || (!JE_PISMENO.test(text.charAt(i - 1)) && !JE_PISMENO.test(text.charAt(konec)));
      if (okraj) vysledek.push([i, konec]);
      od = i + 1;
      if (vysledek.length > 5000) break;
    }
    return vysledek;
  }

  // Priblizne: po slovech. Dotaz o N slovech se porovna s kazdou N-tici
  // po sobe jdoucich slov strany, kazde slovo se svou toleranci.
  const slovaDotazu = dotaz.split(' ').filter(Boolean);
  const slova: { od: number; do: number; s: string }[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  for (let r = re.exec(text); r; r = re.exec(text)) slova.push({ od: r.index, do: r.index + r[0].length, s: r[0] });

  for (let i = 0; i + slovaDotazu.length <= slova.length; i += 1) {
    let sedi = true;
    for (let k = 0; k < slovaDotazu.length && sedi; k += 1) {
      const q = slovaDotazu[k].replace(/[^\p{L}\p{N}]/gu, '');
      const w = slova[i + k].s;
      if (!q) continue;
      const tol = tolerance(q.length);
      // Bez „cela slova" smi byt hledane slovo i zacatkem delsiho (tvary:
      // „Novák" -> „Nováková"), jinak se porovnava cele.
      const kPorovnani = !m.celaSlova && w.length > q.length + tol ? w.slice(0, q.length) : w;
      sedi = vzdalenost(q, kPorovnani, tol) <= tol;
    }
    if (sedi) vysledek.push([slova[i].od, slova[i + slovaDotazu.length - 1].do]);
    if (vysledek.length > 5000) break;
  }
  return vysledek;
}

/** Původní znění úseku textu strany (s diakritikou). */
function puvodni(p: Pripravena, od: number, doo: number): string {
  let s = '';
  for (let i = Math.max(0, od); i < Math.min(doo, p.zdroj.length); i += 1) {
    const z = p.zdroj[i];
    s += z.znak < 0 ? ' ' : p.polozky[z.polozka].str[z.znak] ?? '';
  }
  return s.replace(/\s+/g, ' ');
}

/** Obdélníky úseku - po položkách, uvnitř položky poměrem znaků. */
function ramecky(p: Pripravena, od: number, doo: number): [number, number, number, number][] {
  const podlePolozky = new Map<number, { min: number; max: number }>();
  for (let i = od; i < doo; i += 1) {
    const z = p.zdroj[i];
    if (!z || z.znak < 0) continue;
    const u = podlePolozky.get(z.polozka);
    if (!u) podlePolozky.set(z.polozka, { min: z.znak, max: z.znak });
    else {
      u.min = Math.min(u.min, z.znak);
      u.max = Math.max(u.max, z.znak);
    }
  }
  const out: [number, number, number, number][] = [];
  podlePolozky.forEach((u, i) => {
    const pol = p.polozky[i];
    const delka = Math.max(1, pol.str.length);
    out.push([pol.x + (pol.w * u.min) / delka, pol.y, (pol.w * (u.max - u.min + 1)) / delka, pol.h]);
  });
  return out;
}

const KONTEXT = 40;

/**
 * Hledání v celém textu. Stránky se dají připravit jednou (`pripravStranu`)
 * a hledat v nich opakovaně - při psaní dotazu se tak nic nepřepočítává.
 */
export function hledej(
  strany: Pripravena[],
  dotaz: string,
  m: MoznostiHledani,
  strop = 1000,
): { nalezy: Nalez[]; vic: boolean } {
  const q = normalizujDotaz(dotaz, Boolean(m.presne));
  // Jedno pismeno by nasel vsude - od dvou (u priblizneho od tri) znaku.
  if (q.length < (m.pribizne ? 3 : 2)) return { nalezy: [], vic: false };

  const nalezy: Nalez[] = [];
  for (const p of strany) {
    for (const [od, doo] of najdiVTextu(p.text, q, m)) {
      if (nalezy.length >= strop) return { nalezy, vic: true };
      nalezy.push({
        strana: p.strana,
        pred: (od > KONTEXT ? '…' : '') + puvodni(p, od - KONTEXT, od).trimStart(),
        nalez: puvodni(p, od, doo),
        po: puvodni(p, doo, doo + KONTEXT).trimEnd() + (doo + KONTEXT < p.text.length ? '…' : ''),
        ramecky: ramecky(p, od, doo),
      });
    }
  }
  return { nalezy, vic: false };
}

export type { Pripravena as PripravenaStrana };
