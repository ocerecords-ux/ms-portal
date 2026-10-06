/**
 * JAK SE STUDIO JMENUJE SMĚREM K HERCI (připomínka Heleny 5. 10. 2026: „ať se
 * ve výstupech pro herce studia neoznačují jako Brno I a Brno II, ale adresou
 * (nebo aspoň názvem ulice)").
 *
 * „Brno I" a „Brno II" jsou naše interní jména poboček. Herec podle nich
 * nepozná, kam má jet - a dvě brněnská studia jsou od sebe přes celé město.
 * V nabídce termínů, v Moje termíny, v odebíraném kalendáři a v mailech
 * hercům se proto píše ulice, respektive celá adresa.
 *
 * Uvnitř portálu (kalendář, přehledy, naše maily) zůstávají jména poboček -
 * tam je naopak krátký a jednoznačný název to, co lidi hledají.
 */

export type StudioSAdresou = { name: string; adresa?: string | null };

/**
 * Ulice s číslem: „Pod kaštany 2307/30". Bere se část adresy před první
 * čárkou, protože za ní je PSČ a město. Bez vyplněné adresy zůstává název
 * pobočky - prázdné místo by herci neřeklo vůbec nic.
 */
export function uliceStudia(studio: StudioSAdresou | null | undefined): string {
  if (!studio) return '';
  const adresa = studio.adresa?.trim();
  if (!adresa) return studio.name;
  const ulice = adresa.split(',')[0]?.trim();
  return ulice || studio.name;
}

/** Celá adresa - do kalendáře a tam, kde je na ni místo. */
export function adresaStudia(studio: StudioSAdresou | null | undefined): string {
  if (!studio) return '';
  return studio.adresa?.trim() || studio.name;
}
