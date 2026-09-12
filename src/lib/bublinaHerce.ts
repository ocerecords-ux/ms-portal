/**
 * Bublina se jménem herce (zadání 10. 9. 2026: „nemůžou být zarámované ty
 * jména herců v bublině? V přehledu i v detailu").
 *
 * Třída je tady, ne dvakrát v komponentách: bublina je v přehledu i v detailu
 * a musí vypadat stejně. Kdyby se to psalo na dvou místech, po první úpravě
 * by se to rozešlo.
 *
 * Rámeček dělá z bubliny ohraničený celek - právě to je na ní podstatné.
 * Světlá výplň sama o sobě na bílé kartě skoro mizí.
 *
 * JEDNO JMÉNO = JEDEN ŘÁDEK (zadání 10. 9. 2026: „je nesmysl, aby bylo jméno
 * v bublině na dva řádky"). Zalomené jméno bublinu roztrhne a přestane
 * vypadat jako jeden celek. Bublina si radši vezme šířku, kterou potřebuje -
 * a když jich bude víc, jdou pod sebe (viz TRIDA_SLOUPCE_HERCU).
 */
export const TRIDA_BUBLINY_HERCE =
  'rounded-pill border border-brand-purple/40 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight';

/**
 * Bublina DOTOČENÉHO herce (zadání 12. 9. 2026: „pojďme u těch dotočených
 * herců cestou minimalismu — nechme tu bublinu fialovou a jen to obtáhneme
 * tenkou zelenou linkou, i v detailu i v přehledu").
 *
 * Od běžné bubliny se liší JEDINĚ tou linkou. Výplň i písmo zůstávají
 * fialové, takže sloupec herců drží jeden vzhled a zelená v něm znamená
 * právě jednu věc: hotovo. Předtím byla dotočená bublina celá zelená
 * a přebíjela všechno ostatní na kartě.
 */
export const TRIDA_BUBLINY_DOTOCENO =
  'rounded-pill border border-brand-green bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight';

/**
 * ZALAMOVÁNÍ SI ŘÍDÍ MÍSTO POUŽITÍ (oprava 12. 9. 2026: „Valůšek herec je
 * třeba useklý"). Třída měla `whitespace-nowrap`, a protože Tailwind vydává
 * `nowrap` až za `normal`, přebila i tam, kde se zalomit mělo — jméno pak
 * vyjelo ze sloupce a sloupec ho uřízl. Kde má jméno držet na jednom řádku
 * (výběr herce, detail projektu), přidá se `whitespace-nowrap` u sebe.
 */

/** Víc herců u jednoho projektu jde pod sebe, ne za sebe na jeden řádek. */
export const TRIDA_SLOUPCE_HERCU = 'flex flex-col items-start gap-1';
