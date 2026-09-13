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

/**
 * Adresa fotky uživatele, nebo null, když žádnou nemá.
 *
 * Druhý parametr je buď samotná fotka, nebo jen příznak `maFotku` — v seznamech
 * se schválně vybírá jen ten, aby se base64 obrázek vůbec netahal z databáze
 * (12. 9. 2026, překročený egress na Supabase).
 */
export function odkazNaFotku(
  userId: string,
  fotkaNeboPriznak: string | boolean | null | undefined,
): string | null {
  if (!fotkaNeboPriznak) return null;
  return `/api/uzivatele/${userId}/fotka`;
}
