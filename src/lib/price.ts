import type { Currency } from '@prisma/client';

/**
 * Vypocet predbezne ceny objednavky audioknihy.
 * cena = pocet normostran x sazba klienta (Kc / normostrana)
 */
export function calculatePrice(pageCount: number | null | undefined, ratePerPage: number): number {
  const pages = Number(pageCount) || 0;
  const rate = Number(ratePerPage) || 0;
  return Math.round(pages * rate);
}

/**
 * SPODNI HRANICE OBJEDNAVKY AUDIOKNIHY (zadani 13. 10. 2026: „potrebuji
 * u objednavek vsech audioknih nastavit spodni hranici, za kolik jsme ten
 * projekt schopni rozjet. Spodni hrana je 12 000,- bez DPH").
 *
 * JE TO MINIMALNI CENA CELEHO PROJEKTU, ne minimalni pocet normostran. Tenka
 * knizka tedy nestoji 7 500 Kc, ale 12 000 Kc — pod tim se projekt nerozjede
 * (reziser, studio, postprodukce a korektura se zaplati i u sta stran).
 * Castka je VZDY BEZ DPH, stejne jako cokoli jineho v objednavce.
 *
 * PLATI JEN NA NOVOU OBJEDNAVKU Z WEBU (upresneni 14. 10. 2026: „žadne
 * nabidky nemen! Ta spodni hranice se tyka objednavek z webu novych az od
 * ted. Kdyz nekdo zalozi, aby tam byla spodni hranice.")
 *
 * UZ BEZICIM ZAKAZKAM SE NEPREPOCITAVA NIC - ani rozpocet projektu, ani
 * prehled Knihy, ani palubovka, a uz vubec ne cenova nabidka. Jednou
 * dohodnuta cena je dohodnuta cena a portal do ni nesaha. 13. 10. 2026 jsem
 * tu hranici nasadil i na tyhle prepocty a objevila se u zakazek, kterych se
 * netykala; proto to tady stoji takhle natvrdo.
 *
 * ZMENA CENY SE DELA TADY, na jednom miste. Prepise se tim predbezna cena
 * NOVE objednavky, a tim i potvrzovaci mail klientovi a nase notifikace.
 *
 * MENA: hranice je dohodnuta v korunach. U firmy, ktera ma sazbu v jine mene
 * (britsky klient ma libry), se zadna hranice neuplatnuje, dokud tady pro tu
 * menu nestoji cislo — prepocitavat 12 000 Kc kurzem by delalo pokazde jinou
 * cenu a klient by nevedel, na cem je.
 */
export const MINIMALNI_CENA_PROJEKTU: Partial<Record<Currency, number>> = {
  CZK: 12000,
};

/** Spodni hranice pro danou menu, nebo null kdyz pro ni zadna neplati. */
export function minimalniCena(mena: Currency): number | null {
  return MINIMALNI_CENA_PROJEKTU[mena] ?? null;
}

/**
 * Zvedne cenu na spodni hranici. `zvednuto` rika, ze se to opravdu stalo —
 * podle toho se klientovi ukaze veta, proc je v objednavce jina castka, nez
 * vychazi ze sazby. Nula se nechava nulou: prazdny formular nema tvrdit, ze
 * uz se o nejake cene rozhodlo.
 */
export function uplatniSpodniHranici(
  cena: number,
  mena: Currency,
): { cena: number; hranice: number | null; zvednuto: boolean } {
  const hranice = minimalniCena(mena);
  if (hranice == null || cena <= 0 || cena >= hranice) {
    return { cena, hranice, zvednuto: false };
  }
  return { cena: hranice, hranice, zvednuto: true };
}

export function formatKc(amount: number | null | undefined): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('cs-CZ').format(value) + ' Kč';
}
