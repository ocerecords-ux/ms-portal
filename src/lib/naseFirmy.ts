/**
 * NAŠE FIRMY V PORTÁLU (zadání 12. 10. 2026: „přidal jsem teď ještě jednu
 * naši firmu do portálu a musíme teď vymyslet logiku, jak to dělat. Určitě
 * potřebuji oddělit účetnictví, ale zároveň chci ponechat řízení projektů
 * a kalendáře v jednom portálu").
 *
 * JAK TO JE ROZDĚLENÉ:
 *  - ÚČETNICTVÍ je oddělené. Každá naše firma (IssuerCompany) má vlastní
 *    číselné řady, bankovní účty a napojení na banku; doklad u sebe od
 *    začátku nese, která firma ho vystavila.
 *  - ŘÍZENÍ PRÁCE je společné. Projekty, kalendář, natáčecí plány, chat
 *    i úkoly jsou pro obě firmy jedny a tytéž - tohle rozdělení se jich
 *    nedotýká.
 *
 * PODLE ČEHO SE POZNÁ, ČÍ ZAKÁZKA TO JE: podle KLIENTA. Na kartě klienta je
 * pole „Naše firma" (Company.vydavatelId) a cokoliv se tomu klientovi
 * vystaví - a cokoliv se u jeho zakázek utratí - jde pod ni. Klient bez
 * vyplněného pole spadne pod firmu označenou jako výchozí, takže se
 * u stávajících zakázek nic nemění.
 */

/** Cookie s vybranou naší firmou - přepínač v liště Dokladů. */
export const KLIC_FIRMY = 'msportal_nase_firma';

/** Rok platnosti, stejně jako u jazyka. */
export const PLATNOST_FIRMY_S = 60 * 60 * 24 * 365;

/** Hodnota přepínače, když se mají ukázat doklady všech našich firem. */
export const VSECHNY_FIRMY = '';
