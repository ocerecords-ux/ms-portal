/**
 * Doklady z e-mailové schránky — společné věci (zadání 12. 9. 2026).
 *
 * „Všechny doklady — faktury herců, za nájem, od dodavatelů — nám chodí na
 * mail uctarna@mediaspace.cz. Potřeboval bych z toho mailu vytáhnout přílohy
 * a naše účetní pak měla možnost, že se jí to objeví v záložce Výdaje jako
 * nezařazené a bude třeba je ručně překontrolovat a zařadit."
 *
 * Tenhle soubor je bez Prismy i bez Node, aby si ho mohl vzít i formulář
 * v prohlížeči. Samotné stahování sedí v postaServer.ts.
 */

/** Přílohy, které mají šanci být dokladem. Zbytek (docx, zip) se přeskočí. */
export const POVOLENE_TYPY_PRILOH = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Malé obrázky jsou skoro vždycky logo z podpisu nebo ikonka sociální sítě.
 * Doklad vyfocený telefonem ani naskenovaná faktura pod 20 kB nebývá.
 */
export const MIN_PRILOHA_BYTES = 20 * 1024;

/** Nad tuhle velikost přílohu nebereme — do modelu i do úložiště by se cpala zbytečně. */
export const MAX_PRILOHA_BYTES = 12 * 1024 * 1024;

/** Kolik zpráv se přečte na jedno spuštění, ať kontrola pošty netrvá minutu. */
export const ZPRAV_NA_JEDNO_KOLO = 15;

/** Kolik dokladů se na jedno kolo pošle modelu ke čtení (každý pár vteřin). */
export const CTENI_NA_JEDNO_KOLO = 3;

export type StavPosty = {
  /** Jsou vyplněné přístupové údaje ke schránce? */
  nastaveno: boolean;
  posledniKontrolaAt: string | null;
  posledniChyba: string | null;
  /** Kolik dokladů čeká na zařazení. */
  nezarazeno: number;
  /** Kolik z nich ještě nemá vyčtené údaje. */
  bezNavrhu: number;
};

export type VysledekKontroly = {
  /** Kolik nových dokladů přibylo. */
  zalozeno: number;
  /** Kolik dokladů se právě podařilo přečíst. */
  precteno: number;
  /** Zůstalo ve schránce ještě něco na příště? */
  zbyva: boolean;
  chyba: string | null;
};
