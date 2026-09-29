/**
 * KDY PŮJDE UPOMÍNKA A KDY ŠLA (zadání 29. 9. 2026: „potřeboval bych vědět
 * den dopředu, aby mi svítilo, že půjde upomínka za fakturu. A že šla a kdy.
 * Chci to vidět i v tom rychlém přehledu projektu, když kliknu na ikonu
 * dokladu").
 *
 * Do teď se dalo zjistit jen to, co už odešlo, a jen na jedné stránce
 * (Doklady → Upomínky). Že klientovi zítra ráno odejde upomínka, se nedalo
 * poznat nikde - a to je přesně ta chvíle, kdy se ještě dá říct „počkej,
 * tuhle nech být, domluvili jsme se s nimi jinak".
 *
 * Soubor je bez Prismy - počítá ho server i prohlížeč, ať na obou místech
 * vyjde totéž. Čtení z databáze je v lib/upominkyServer.ts.
 *
 * ÚLOHA BĚŽÍ JEN V PRACOVNÍ DNY RÁNO (vercel.json: `30 6 * * 1-5`), takže
 * upomínka, která vyjde na sobotu, odejde až v pondělí. Kdyby se to tady
 * nepočítalo, svítilo by v pátek „zítra" a v sobotu by se nestalo nic.
 */

/** Půlnoc dne v pražském kalendáři, držená jako půlnoc UTC - stejně jako splatnost. */
export function denUTC(d: Date): Date {
  const praha = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  return new Date(Date.UTC(praha.getFullYear(), praha.getMonth(), praha.getDate()));
}

function pridejDny(d: Date, dnu: number): Date {
  return new Date(d.getTime() + dnu * 86_400_000);
}

/** Sobota a neděle se posunou na pondělí - úloha o víkendu neběží. */
function naPracovniDen(d: Date): Date {
  const den = d.getUTCDay();
  if (den === 6) return pridejDny(d, 2);
  if (den === 0) return pridejDny(d, 1);
  return d;
}

export type OdeslanaUpominka = { poradi: number; kdy: string };

export type StavUpominky = {
  /** Co odešlo, od nejnovější. */
  odeslane: OdeslanaUpominka[];
  /**
   * Kolikátá půjde příště a kdy. `zaDnu` je 0 pro dnešek, 1 pro zítřek.
   * Null = další už nepůjde (všechny odešly, faktura je zaplacená, není
   * splatnost, nebo jsou upomínky vypnuté).
   */
  dalsi: { poradi: number; kdy: string; zaDnu: number } | null;
  /** Upomínky jsou v nastavení vypnuté - nic nepůjde, ať nesvítí termín. */
  vypnuto: boolean;
};

export const PRAZDNY_STAV_UPOMINKY: StavUpominky = { odeslane: [], dalsi: null, vypnuto: false };

export function stavUpominky(vstup: {
  /** Splatnost faktury; bez ní se nemá od čeho počítat. */
  splatnost: Date | null;
  /** Upomínky chodí jen k odeslané a nezaplacené faktuře. */
  posilaSe: boolean;
  /** Prahy ze nastavení: [3, 10, 21] = třetí, desátý a jednadvacátý den po splatnosti. */
  dny: number[];
  zapnuto: boolean;
  /** Co už odešlo. Pořadí nerozhoduje, setřídí se tady. */
  odeslane: { poradi: number; kdy: Date }[];
  /** Kdy se počítá - do testů; jinak teď. */
  ted?: Date;
}): StavUpominky {
  const ted = vstup.ted ?? new Date();
  const odeslane = [...vstup.odeslane]
    .sort((a, b) => b.kdy.getTime() - a.kdy.getTime())
    .map((o) => ({ poradi: o.poradi, kdy: o.kdy.toISOString() }));

  const hotovo = { odeslane, dalsi: null, vypnuto: !vstup.zapnuto };
  if (!vstup.zapnuto || !vstup.posilaSe || !vstup.splatnost) return hotovo;

  const poradi = vstup.odeslane.length + 1;
  if (poradi > vstup.dny.length) return hotovo;
  const prah = vstup.dny[poradi - 1];
  if (!Number.isFinite(prah)) return hotovo;

  const dnes = denUTC(ted);
  let kdy = pridejDny(denUTC(vstup.splatnost), prah);

  // Jedné faktuře jde za běh nejvýš jedna upomínka, takže další nejdřív
  // druhý den po té poslední.
  const posledni = vstup.odeslane.reduce<Date | null>(
    (nej, o) => (!nej || o.kdy > nej ? o.kdy : nej),
    null,
  );
  if (posledni) {
    const poPosledni = pridejDny(denUTC(posledni), 1);
    if (poPosledni.getTime() > kdy.getTime()) kdy = poPosledni;
  }

  /**
   * Termín v minulosti neznamená, že se nestane nic - znamená, že to odejde
   * nejbližší ráno. Přesně tenhle stav nastal, když úlohy pět dní nechodily
   * (29. 9. 2026): upomínky byly „na spadnutí" a portál to tvrdil s datem
   * zpátky v čase.
   */
  if (kdy.getTime() < dnes.getTime()) kdy = dnes;
  kdy = naPracovniDen(kdy);

  const zaDnu = Math.round((kdy.getTime() - dnes.getTime()) / 86_400_000);
  return { odeslane, dalsi: { poradi, kdy: kdy.toISOString(), zaDnu }, vypnuto: false };
}

/** „1. upomínka", „2. upomínka" - do věty i do štítku. */
export function popisPoradi(poradi: number): string {
  return `${poradi}. upomínka`;
}

const DATUM = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

/** „dnes ráno", „zítra ráno", „v pondělí 6. 10." - jedna věta, neskládá se z kousků. */
export function kdyPujde(dalsi: { kdy: string; zaDnu: number }): string {
  if (dalsi.zaDnu <= 0) return 'dnes ráno';
  if (dalsi.zaDnu === 1) return 'zítra ráno';
  return DATUM.format(new Date(dalsi.kdy));
}

export function kdyOdesla(kdy: string): string {
  return DATUM.format(new Date(kdy));
}

/**
 * Má to svítit? Den dopředu a dneškem počínaje - o tom je celé zadání.
 * Dřív by z toho byla tapeta: faktura po splatnosti visí i měsíc.
 */
export function upominkaNaSpadnuti(stav: StavUpominky): boolean {
  return stav.dalsi !== null && stav.dalsi.zaDnu <= 1;
}
