/**
 * DODÁVÁ HUDBU K TOMUHLE PROJEKTU KLIENT? (zadání 17. 10. 2026: „když teď
 * zaškrtnu u firmy, že klient dodává hudbu, tak aby nešly zpětně na klienta
 * nějaké notifikace. Ať to platí až od teď.")
 *
 * Nestačí se zeptat firmy. Zaškrtávátko se zapíná uprostřed běžícího provozu
 * a bez tohohle pravidla by hned druhé ráno odešly výzvy ke všem rozdělaným
 * knihám, které mají za pár dní první frekvenci - klient by nechápal, proč po
 * něm najednou chceme hudbu k něčemu, co se už natáčí.
 *
 * Rozhoduje proto OKAMŽIK ZAPNUTÍ: výzva chodí jen k projektům, které vznikly
 * potom. Starší zakázky dobíhají po staru a hudbu k nim vybereme my.
 *
 * Ručnímu tlačítku „Poslat výzvu hned" tohle nebrání - to je vědomé
 * rozhodnutí člověka u konkrétního projektu.
 *
 * SOUBOR JE BEZ PRISMY - stejné pravidlo potřebuje úloha na pozadí, karta
 * projektu i přehled chybějící hudby, a tři kopie by se po první opravě
 * rozešly.
 */
export type FirmaHudba = {
  hudbuDodavaKlient?: boolean | null;
  hudbaKlientOd?: Date | string | null;
};

export function hudbuDodavaKlient(
  firma: FirmaHudba | null | undefined,
  projektVznikl: Date | string | null | undefined,
): boolean {
  if (!firma?.hudbuDodavaKlient) return false;
  if (!firma.hudbaKlientOd) return true; // zapnuto dřív, než se tohle hlídalo

  const odKdy = new Date(firma.hudbaKlientOd).getTime();
  if (!Number.isFinite(odKdy)) return true;

  // Projekt bez data vzniku je starý záznam - ten se bere jako „před zapnutím".
  if (!projektVznikl) return false;
  const vznikl = new Date(projektVznikl).getTime();
  return Number.isFinite(vznikl) && vznikl >= odKdy;
}
