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
 * Rozhoduje proto OKAMŽIK ZAPNUTÍ: výzva SAMA chodí jen k projektům, které
 * vznikly potom. U starších zakázek té firmy se ozve zvoneček nám - ne proto,
 * že bychom hudbu vybírali, ale aby někdo klientovi napsal ručně.
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

/**
 * DODÁVÁ HUDBU TAHLE FIRMA? Prostá pravda o firmě, bez ohledu na datum.
 *
 * Tohle se píše do obrazovek (oprava 17. 10. 2026: „tady to není propojené.
 * Hudbu pro Audiolibrix nevybíráme my."). U staršího projektu klientské firmy
 * sice výzva sama neodejde, ale napsat k němu „hudbu vybíráme my" je lež -
 * nevybíráme, jen po klientovi musíme sáhnout ručně.
 */
export function firmaDodavaHudbu(firma: FirmaHudba | null | undefined): boolean {
  return firma?.hudbuDodavaKlient === true;
}

/**
 * PŮJDE VÝZVA SAMA? Tohle je to přísnější pravidlo - jen u projektů, které
 * vznikly po zapnutí zaškrtávátka. Podle něj se rozhoduje úloha na pozadí.
 */
export function vyzvaPujdeSama(
  firma: FirmaHudba | null | undefined,
  projektVznikl: Date | string | null | undefined,
): boolean {
  if (!firmaDodavaHudbu(firma)) return false;
  if (!firma?.hudbaKlientOd) return true; // zapnuto dřív, než se tohle hlídalo

  const odKdy = new Date(firma.hudbaKlientOd).getTime();
  if (!Number.isFinite(odKdy)) return true;

  // Projekt bez data vzniku je starý záznam - ten se bere jako „před zapnutím".
  if (!projektVznikl) return false;
  const vznikl = new Date(projektVznikl).getTime();
  return Number.isFinite(vznikl) && vznikl >= odKdy;
}
