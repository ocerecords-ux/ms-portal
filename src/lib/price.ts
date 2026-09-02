/**
 * Vypocet predbezne ceny objednavky audioknihy.
 * cena = pocet normostran x sazba klienta (Kc / normostrana)
 */
export function calculatePrice(pageCount: number | null | undefined, ratePerPage: number): number {
  const pages = Number(pageCount) || 0;
  const rate = Number(ratePerPage) || 0;
  return Math.round(pages * rate);
}

export function formatKc(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('cs-CZ').format(value) + ' Kč';
}
