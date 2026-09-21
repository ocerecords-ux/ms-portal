/**
 * Záložky sekce Přehledy (zadání 20. 9. 2026: „z něj pak uděláme záložku, ne
 * toto"). Seznam je schválně v obyčejném souboru, ne v klientské komponentě: čte ho
 * server (přesměrování z /prehledy na první záložku) i klient (lišta
 * záložek). Kdyby seznam bydlel v klientské komponentě, server by si z něj
 * nesměl sáhnout ani na jeden odkaz a stránka by spadla.
 *
 * Další přehled = jeden řádek sem.
 */
export const ZALOZKY_PREHLEDU: { href: string; label: string; role?: string[] }[] = [
  { href: '/prehledy/kapacita', label: 'Kapacita studií' },
  // Peníze firmy vidí jen admin (21. 9. 2026).
  { href: '/prehledy/finance', label: 'Obrat a zisk', role: ['ADMIN'] },
];
