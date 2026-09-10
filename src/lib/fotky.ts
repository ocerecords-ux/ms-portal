/**
 * Odkazy na profilové fotky (10. 9. 2026).
 *
 * PROČ TO JE: fotky uživatelů jsou v databázi uložené jako data: URL, což je
 * kus obrázku převedený na text - jedna má klidně 70 kB. Když se takový
 * řetězec přibalí ke každé zprávě v chatu, má osm zpráv půl megabajtu a
 * načítání trvá vteřiny. Chat s tím měřitelně bojoval.
 *
 * Místo obrázku se proto posílá jen adresa. Prohlížeč si fotku stáhne jednou,
 * uloží do mezipaměti a u dalších zpráv už ji jen použije.
 */

/** Adresa fotky uživatele, nebo null, když žádnou nemá. */
export function odkazNaFotku(userId: string, photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  return `/api/uzivatele/${userId}/fotka`;
}
