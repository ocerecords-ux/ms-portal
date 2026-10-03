/**
 * Záložky sekce Přehledy (zadání 20. 9. 2026: „z něj pak uděláme záložku, ne
 * toto"). Seznam je schválně v obyčejném souboru, ne v klientské komponentě: čte ho
 * server (přesměrování z /prehledy na první záložku) i klient (lišta
 * záložek). Kdyby seznam bydlel v klientské komponentě, server by si z něj
 * nesměl sáhnout ani na jeden odkaz a stránka by spadla.
 *
 * Další přehled = jeden řádek sem.
 *
 * `label` je ČESKÝ ZDROJ PRAVDY, ne text do rozhraní: lišta si název bere ze
 * slovníku podle ADRESY (`prehledy.zalozka.<href>`), stejně jako horní lišta
 * přes `nazevOdkazu`. Nová záložka tedy potřebuje i klíč ve slovníku.
 */
export const ZALOZKY_PREHLEDU: {
  href: string;
  label: string;
  role?: string[];
  /**
   * Záložka navíc zamčená příznakem na kartě uživatele. Role sama nestačí -
   * Palubovku vidí jen ten, kdo má `vidiPalubovku` (zadání 27. 9. 2026:
   * „vidím jen já a tím řídím celou firmu").
   */
  jenSPriznakem?: 'palubovka';
}[] = [
  // Palubovka je PRVNÍ (zadání 27. 9. 2026: „ať je to první, co se mi ukáže,
  // když otevřu přehledy"). Kdo ji nemá zapnutou, tomu se přeskočí a otevře
  // se Kapacita studií - viz /prehledy/page.tsx.
  { href: '/prehledy/palubovka', label: 'Palubovka', role: ['ADMIN'], jenSPriznakem: 'palubovka' },
  { href: '/prehledy/kapacita', label: 'Kapacita studií' },
  // Backlog - dřív samostatně v liště (přesun 21. 9. 2026).
  { href: '/prehledy/backlog', label: 'Backlog' },
  // Peníze firmy vidí jen admin (21. 9. 2026).
  { href: '/prehledy/finance', label: 'Obrat a zisk', role: ['ADMIN'] },
  // Rozpočty, čerpání a zisk jednotlivých knih (28. 9. 2026, pro Petera).
  // Mzdové údaje celého týmu a marže knih - taky jen admin.
  { href: '/prehledy/knihy', label: 'Knihy a rozpočty', role: ['ADMIN'] },
  // Co chodí zvukařům a kdy (21. 9. 2026) - peníze lidí, jen admin.
  { href: '/prehledy/zvukari', label: 'Zvukaři', role: ['ADMIN'] },
];
