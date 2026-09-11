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
  'whitespace-nowrap rounded-pill border border-brand-purple/40 bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight';

/** Víc herců u jednoho projektu jde pod sebe, ne za sebe na jeden řádek. */
export const TRIDA_SLOUPCE_HERCU = 'flex flex-col items-start gap-1';


/**
 * Zelená fajfka u dotočeného herce (zadání 11. 9. 2026: „jakmile ho někdo
 * stiskne, objeví se vedle jména herce zelená fajfka, ať je to zřejmé.
 * Fajfku prosím v přehledu i v detailu").
 *
 * Třída je tady ze stejného důvodu jako bublina sama: fajfka je na dvou
 * místech a musí vypadat stejně.
 */
export const TRIDA_FAJFKY =
  'shrink-0 inline-grid place-items-center w-[18px] h-[18px] rounded-full bg-brand-green text-onAccent text-[11px] font-bold leading-none';
