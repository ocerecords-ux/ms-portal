import type { DruhNepritomnosti } from '@prisma/client';

/**
 * KALENDÁŘ DOVOLENÝCH A NEPŘÍTOMNOSTI (zadání 19. 9. 2026: „potřebuji jeden
 * kalendář, do kterého si budou lidi psát dovolené a kdy jsou mimo studio.
 * Tam není třeba projekt, jen možnost celodenní události").
 *
 * Tenhle soubor nesahá do databáze - používá ho i kalendář v prohlížeči.
 * Zápis je v lib/nepritomnostServer.ts a v /api/kalendar/nepritomnost.
 */

/** Pásmo, ve kterém se počítá „celý den". Tým sedí v Česku. */
export const PASMO_NEPRITOMNOSTI = 'Europe/Prague';

/**
 * Barva kalendáře v přepínači a u událostí. Jantarová schválně: nesmí se
 * plést s žádným studiem a zároveň nemá působit jako chyba - dovolená není
 * problém, je to informace.
 */
export const BARVA_NEPRITOMNOSTI = '#E0A23B';

export const DRUHY_NEPRITOMNOSTI: { druh: DruhNepritomnosti; popisek: string }[] = [
  { druh: 'DOVOLENA', popisek: 'Dovolená' },
  { druh: 'MIMO_STUDIO', popisek: 'Mimo studio' },
  { druh: 'JINE', popisek: 'Jiné' },
];

export function popisDruhu(druh: string): string {
  return DRUHY_NEPRITOMNOSTI.find((d) => d.druh === druh)?.popisek ?? 'Nepřítomnost';
}

/** Jedna nepřítomnost tak, jak ji dostane kalendář. */
export type NepritomnostVKalendari = {
  id: string;
  userId: string | null;
  jmeno: string;
  druh: DruhNepritomnosti;
  celyDen: boolean;
  /** ISO. U celodenní půlnoc prvního dne v Praze. */
  start: string;
  /** ISO. U celodenní půlnoc PO posledním dni - konec je vyloučený. */
  end: string;
  poznamka: string | null;
  /** Smí ji přihlášený upravit? Svoji vždycky, cizí jen produkce. */
  muzeUpravit: boolean;
};

/** Den v kalendáři „YYYY-MM-DD" z data v pražském čase. */
export function denVPraze(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PASMO_NEPRITOMNOSTI }).format(d);
}

/**
 * Poslední den celodenní nepřítomnosti. Konec je uložený jako půlnoc PO
 * posledním dni, takže se vezme okamžik těsně před ní.
 */
export function posledniDen(endIso: string): string {
  return denVPraze(new Date(new Date(endIso).getTime() - 60_000));
}

/** „12. 9." nebo „12. 9. – 15. 9." - co se napíše do bubliny. */
export function rozsahSlovy(n: Pick<NepritomnostVKalendari, 'start' | 'end' | 'celyDen'>): string {
  const den = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: PASMO_NEPRITOMNOSTI, day: 'numeric', month: 'numeric' }).format(d);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: PASMO_NEPRITOMNOSTI, hour: '2-digit', minute: '2-digit' }).format(d);
  const od = new Date(n.start);
  if (!n.celyDen) return `${den(od)} ${cas(od)}–${cas(new Date(n.end))}`;
  const doDen = new Date(new Date(n.end).getTime() - 60_000);
  return denVPraze(od) === denVPraze(doDen) ? den(od) : `${den(od)} – ${den(doDen)}`;
}
