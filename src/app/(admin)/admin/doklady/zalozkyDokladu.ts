/**
 * Seznam záložek sekce Doklady (29. 9. 2026).
 *
 * Schválně v obyčejném souboru, ne v komponentě lišty: sahá si na něj i
 * přesměrování z /admin/doklady na první záložku. Stejný důvod jako
 * u prehledy/zalozky.ts.
 *
 * Další záložka = jeden řádek sem.
 */
export const ZALOZKY_DOKLADU: { klic: string; href: string; preklad: string }[] = [
  { klic: 'nabidky', href: '/admin/doklady/nabidky', preklad: 'doklady.zalozkaNabidky' },
  { klic: 'faktury', href: '/admin/doklady/faktury', preklad: 'doklady.zalozkaFaktury' },
  // Upominky na faktury po splatnosti (zadani 25. 9. 2026).
  { klic: 'upominky', href: '/admin/doklady/upominky', preklad: 'doklady.zalozkaUpominky' },
  { klic: 'vydaje', href: '/admin/doklady/vydaje', preklad: 'doklady.zalozkaVydaje' },
  // Banku vidi jen ten, kdo na ni ma pravo (17. 9. 2026).
  { klic: 'banka', href: '/admin/doklady/banka', preklad: 'doklady.zalozkaBanka' },
  // Smlouvy s elektronickym podpisem (zadani 8. 9. 2026).
  { klic: 'smlouvy', href: '/admin/doklady/smlouvy', preklad: 'doklady.zalozkaSmlouvy' },
  { klic: 'moje-firmy', href: '/admin/doklady/moje-firmy', preklad: 'doklady.zalozkaMojeFirmy' },
];
