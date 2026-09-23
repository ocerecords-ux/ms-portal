import { zonedToUtc } from '@/lib/calendar';

/**
 * KALENDÁŘ PORADY (zadání 21. 9. 2026: „pojďme teď udělat ještě jeden
 * kalendář Porady, který bude žlutou barvou. Tam by bylo super, kdyby ho
 * viděli jen lidi z týmu, kteří si vytvoří skupinu, jako je to v chatu. Např.
 * chci udělat poradu Já a Karolína, tak když vytvářím událost, dám tam jen nás
 * dva a vidíme to pak jen my ... Mělo by tam jít i nastavit opakování události
 * a přidat link na videohovor").
 *
 * Tenhle soubor nesahá do databáze - používá ho i kalendář v prohlížeči.
 * Načítání je v lib/poradyServer.ts, zápis v /api/kalendar/porady.
 */

export const NAZEV_KALENDARE_PORADY = 'Porady';

/**
 * DALŠÍ SCHŮZKY (zadání 23. 9. 2026: „udělej mi rovnou kalendář další
 * schůzky. Měl by to být stejný typ kalendáře, jako porady. Vidí ho
 * Žůžo-labůžo a produkce").
 *
 * Je to tentýž kalendář jako Porady, jen s jiným štítkem, barvou a jiným
 * pravidlem, kdo ho vidí: poradu vidí POZVANÍ, schůzku CELÁ PRODUKCE. Proto
 * to není druhý model, ale `druh` u téhož záznamu - opakování, videohovor
 * i rušení jednoho výskytu se tím nemusí psát dvakrát.
 */
export type DruhPorady = 'PORADA' | 'SCHUZKA';

export const NAZEV_KALENDARE_SCHUZKY = 'Další schůzky';

/** Tyrkysová - vedle žluté Porady na první pohled jiný kalendář. */
export const BARVA_SCHUZEK = '#14B8A6';

/** Značka v adrese kalendáře pro sólo Dalších schůzek. */
export const SOLO_SCHUZKY = 'schuzky';

/** Štítek kalendáře podle druhu - ať se to nikde nepíše natvrdo. */
export function nazevKalendare(druh: DruhPorady): string {
  return druh === 'SCHUZKA' ? NAZEV_KALENDARE_SCHUZKY : NAZEV_KALENDARE_PORADY;
}

/** Barva kalendáře podle druhu. */
export function barvaKalendare(druh: DruhPorady): string {
  return druh === 'SCHUZKA' ? BARVA_SCHUZEK : BARVA_PORAD;
}

/** „porada" / „schůzka" do vět v okně a hlášek. */
export function slovoProDruh(druh: DruhPorady): string {
  return druh === 'SCHUZKA' ? 'schůzka' : 'porada';
}

/**
 * Žlutá jako „Schůzky" v Google kalendáři, na který je tým zvyklý. Šestimístný
 * hex - průhlednost se k ní přidává příponou (`${BARVA}33`).
 */
export const BARVA_PORAD = '#F2CB35';

/** Značka v adrese kalendáře pro sólo Porad (vedle `mimo`). */
export const SOLO_PORADY = 'porady';

export const PASMO_PORAD = 'Europe/Prague';

export type Opakovani = 'NE' | 'DENNE' | 'PRACOVNI_DNY' | 'TYDNE' | 'KAZDE_DVA_TYDNY' | 'MESICNE';

export const MOZNOSTI_OPAKOVANI: { hodnota: Opakovani; popisek: string }[] = [
  { hodnota: 'NE', popisek: 'Neopakovat' },
  { hodnota: 'DENNE', popisek: 'Každý den' },
  { hodnota: 'PRACOVNI_DNY', popisek: 'Každý pracovní den (po–pá)' },
  { hodnota: 'TYDNE', popisek: 'Každý týden' },
  { hodnota: 'KAZDE_DVA_TYDNY', popisek: 'Každé dva týdny' },
  { hodnota: 'MESICNE', popisek: 'Každý měsíc' },
];

export function popisOpakovani(o: Opakovani): string {
  return MOZNOSTI_OPAKOVANI.find((m) => m.hodnota === o)?.popisek ?? 'Neopakovat';
}

/** Jeden výskyt porady tak, jak ho dostane kalendář. */
export type PoradaVKalendari = {
  /** Id výskytu: `<id porady>:<YYYY-MM-DD>` - u neopakované taky. */
  id: string;
  poradaId: string;
  /** Do kterého z obou kalendářů patří (23. 9. 2026). */
  druh: DruhPorady;
  /** Den výskytu v Praze, YYYY-MM-DD. */
  den: string;
  nazev: string;
  start: string;
  end: string;
  opakovani: Opakovani;
  /** YYYY-MM-DD nebo null. */
  opakovatDo: string | null;
  odkazVideo: string | null;
  poznamka: string | null;
  ucastnici: { id: string; label: string }[];
  zalozil: string | null;
  /** Poslední změna porady (ISO) - pro odběr v telefonu. */
  upraveno: string;
};

/** Pravidlo porady - co je potřeba k dopočítání výskytů. */
export type PravidloPorady = {
  start: Date;
  end: Date;
  opakovani: Opakovani;
  opakovatDo: string | null;
  vynechano: string[];
};

/** Den a minuta v Praze z okamžiku. */
export function vPraze(d: Date): { den: string; minuty: number } {
  const casti = new Intl.DateTimeFormat('en-CA', {
    timeZone: PASMO_PORAD,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const v = (t: string) => casti.find((c) => c.type === t)?.value ?? '00';
  return { den: `${v('year')}-${v('month')}-${v('day')}`, minuty: Number(v('hour')) * 60 + Number(v('minute')) };
}

const DEN_MS = 24 * 3600 * 1000;
/** Pořadí dne jako celé číslo - pro rozdíly ve dnech bez vlivu letního času. */
function cisloDne(den: string): number {
  const [y, m, d] = den.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DEN_MS);
}
function denZCisla(n: number): string {
  return new Date(n * DEN_MS).toISOString().slice(0, 10);
}

/**
 * VÝSKYTY PORADY V ROZSAHU [od, do). Opakování se neukládá jako stovky řádků,
 * ale dopočítává se tady - pro zobrazený týden nebo měsíc.
 *
 * Počítá se v pražském čase: porada „každé pondělí v 9:00" je v 9:00 i po
 * přechodu na zimní čas, ne v 8:00.
 */
export function vyskytyPorady(p: PravidloPorady, od: Date, doKdy: Date): { den: string; start: Date; end: Date }[] {
  const prvni = vPraze(p.start);
  const delka = p.end.getTime() - p.start.getTime();
  const zaklad = cisloDne(prvni.den);
  const [, , denVMesici] = prvni.den.split('-').map(Number);

  if (p.opakovani === 'NE') {
    if (p.end > od && p.start < doKdy && !p.vynechano.includes(prvni.den)) {
      return [{ den: prvni.den, start: p.start, end: p.end }];
    }
    return [];
  }

  // Den před začátkem rozsahu - porada přes půlnoc by jinak vypadla.
  const zacatek = Math.max(zaklad, cisloDne(vPraze(od).den) - 1);
  const konecRozsahu = cisloDne(vPraze(doKdy).den);
  const konec = p.opakovatDo ? Math.min(konecRozsahu, cisloDne(p.opakovatDo)) : konecRozsahu;

  const vysledek: { den: string; start: Date; end: Date }[] = [];
  for (let n = zacatek; n <= konec; n++) {
    const den = denZCisla(n);
    const rozdil = n - zaklad;
    const [y, m, d] = den.split('-').map(Number);
    const vTydnu = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const sedi =
      p.opakovani === 'DENNE' ||
      (p.opakovani === 'PRACOVNI_DNY' && vTydnu >= 1 && vTydnu <= 5) ||
      (p.opakovani === 'TYDNE' && rozdil % 7 === 0) ||
      (p.opakovani === 'KAZDE_DVA_TYDNY' && rozdil % 14 === 0) ||
      // Měsíc bez toho dne (31. v dubnu) se přeskočí - jako v Google kalendáři.
      (p.opakovani === 'MESICNE' && d === denVMesici);
    if (!sedi || p.vynechano.includes(den)) continue;
    const start = zonedToUtc(y, m, d, prvni.minuty, PASMO_PORAD);
    const end = new Date(start.getTime() + delka);
    if (end > od && start < doKdy) vysledek.push({ den, start, end });
  }
  return vysledek;
}

/** Je odkaz na videohovor opravdu webová adresa? Jinak ho neukazujeme jako odkaz. */
export function platnyOdkaz(odkaz: string | null | undefined): string | null {
  const t = (odkaz ?? '').trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
