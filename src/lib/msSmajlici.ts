/**
 * Mediaspace smajlíci do chatu (zadání 9. 9. 2026: "udělej nám v chatu naše
 * Mediaspace smajlíky v barvách").
 *
 * Kreslení v barvách portálu: obličeje na zeleném kolečku (#1FDF67) s tmavými
 * rysy, symboly na fialovém (#7B55FF) s bílým nebo zeleným znakem. Žádná
 * knihovna navíc - je to šestnáct kousků SVG, které se vejdou sem.
 *
 * Do zprávy se ukládá jen zkratka (":ms-usmev:"), obrázek se vykreslí až při
 * zobrazení (viz components/MsSmajlik.tsx). Text zprávy tak zůstane čitelný
 * i v databázi nebo v e-mailu a sada se dá kdykoliv překreslit, aniž by se
 * sahalo do starých zpráv.
 *
 * Soubor je záměrně bez Prismy a bez Reactu, aby šel použít i v prohlížeči.
 */

export type MsSmajlik = {
  /** Zkratka, která se ukládá do textu zprávy. */
  code: string;
  /** Popisek do nabídky a pro čtečky obrazovky. */
  label: string;
  /** Vnitřek SVG (viewBox "0 0 24 24") - vlastní obsah, nic od uživatele. */
  svg: string;
};

export const MS_SMAJLICI: MsSmajlik[] = [
  { code: ':ms-usmev:', label: 'Úsměv', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <circle cx="8.6" cy="9.8" r="1.4" fill="#201A33"/> <circle cx="15.4" cy="9.8" r="1.4" fill="#201A33"/> <path d="M7.6 14.2c1.2 2 2.7 3 4.4 3s3.2-1 4.4-3" stroke="#201A33" stroke-width="1.9" stroke-linecap="round" fill="none"/>' },
  { code: ':ms-smich:', label: 'Smích', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <path d="M6.6 10.6c.8-1.4 2.3-1.4 3.1 0M14.3 10.6c.8-1.4 2.3-1.4 3.1 0" stroke="#201A33" stroke-width="1.8" stroke-linecap="round" fill="none"/> <path d="M6.8 13.6h10.4c0 2.9-2.3 5.2-5.2 5.2s-5.2-2.3-5.2-5.2z" fill="#201A33"/>' },
  { code: ':ms-mrk:', label: 'Mrknutí', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <circle cx="8.6" cy="9.8" r="1.4" fill="#201A33"/> <path d="M13.9 10.3c.8-1.3 2.3-1.3 3.1 0" stroke="#201A33" stroke-width="1.8" stroke-linecap="round" fill="none"/> <path d="M7.8 14.2c1.1 1.9 2.6 2.8 4.2 2.8s3.1-.9 4.2-2.8" stroke="#201A33" stroke-width="1.9" stroke-linecap="round" fill="none"/>' },
  { code: ':ms-super:', label: 'Paráda', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <path d="M6.3 7.8c.9-1 2.5-1 3.4 0M14.3 7.8c.9-1 2.5-1 3.4 0" stroke="#201A33" stroke-width="1.6" stroke-linecap="round" fill="none"/> <circle cx="8.6" cy="10.8" r="1.3" fill="#201A33"/> <circle cx="15.4" cy="10.8" r="1.3" fill="#201A33"/> <path d="M7.2 14h9.6c0 2.7-2.1 4.8-4.8 4.8S7.2 16.7 7.2 14z" fill="#201A33"/>' },
  { code: ':ms-premyslim:', label: 'Přemýšlím', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <path d="M6.3 7.9c.9-1 2.5-1 3.4 0" stroke="#201A33" stroke-width="1.6" stroke-linecap="round" fill="none"/> <circle cx="8.6" cy="10.8" r="1.3" fill="#201A33"/> <circle cx="15.4" cy="10.8" r="1.3" fill="#201A33"/> <path d="M9 15.8c1.7-.9 3.5-1.1 5.4-.5" stroke="#201A33" stroke-width="1.8" stroke-linecap="round" fill="none"/>' },
  { code: ':ms-prekvapeni:', label: 'Překvapení', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <circle cx="8.4" cy="10" r="1.5" fill="#201A33"/> <circle cx="15.6" cy="10" r="1.5" fill="#201A33"/> <ellipse cx="12" cy="15.3" rx="2.1" ry="2.6" fill="#201A33"/>' },
  { code: ':ms-smutek:', label: 'Smutek', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <circle cx="8.6" cy="10" r="1.4" fill="#201A33"/> <circle cx="15.4" cy="10" r="1.4" fill="#201A33"/> <path d="M8 16.6c1-1.6 2.4-2.4 4-2.4s3 .8 4 2.4" stroke="#201A33" stroke-width="1.9" stroke-linecap="round" fill="none"/>' },
  { code: ':ms-unaveny:', label: 'Unavený', svg: '<circle cx="12" cy="12" r="11" fill="#1FDF67"/> <path d="M6.8 10.4h3.4M13.8 10.4h3.4" stroke="#201A33" stroke-width="1.8" stroke-linecap="round"/> <path d="M9.6 15.4h4.8" stroke="#201A33" stroke-width="1.8" stroke-linecap="round"/>' },
  { code: ':ms-palec:', label: 'Palec nahoru', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <path d="M9.6 10.9l2.7-4.4c.3-.5.9-.7 1.4-.5.6.2 1 .8.9 1.5l-.4 2.3h3.2c.9 0 1.6.9 1.4 1.8l-1 4.4c-.2.8-.9 1.4-1.7 1.4H9.6z" fill="#FFFFFF"/> <rect x="5.2" y="10.6" width="3.1" height="6.8" rx="1.1" fill="#FFFFFF"/>' },
  { code: ':ms-palec-dolu:', label: 'Palec dolů', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <g transform="rotate(180 12 12)"> <path d="M9.6 10.9l2.7-4.4c.3-.5.9-.7 1.4-.5.6.2 1 .8.9 1.5l-.4 2.3h3.2c.9 0 1.6.9 1.4 1.8l-1 4.4c-.2.8-.9 1.4-1.7 1.4H9.6z" fill="#FFFFFF"/> <rect x="5.2" y="10.6" width="3.1" height="6.8" rx="1.1" fill="#FFFFFF"/> </g>' },
  { code: ':ms-sluchatka:', label: 'Poslouchám', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <path d="M6.4 15v-2.4a5.6 5.6 0 0 1 11.2 0V15" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round" fill="none"/> <rect x="4.7" y="13.6" width="3.4" height="5" rx="1.7" fill="#FFFFFF"/> <rect x="15.9" y="13.6" width="3.4" height="5" rx="1.7" fill="#FFFFFF"/>' },
  { code: ':ms-hotovo:', label: 'Hotovo', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <path d="M6.8 12.4l3.5 3.5 6.9-7.2" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' },
  { code: ':ms-pozor:', label: 'Pozor', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <path d="M11.1 6.7a1.05 1.05 0 0 1 1.8 0l5.1 8.8a1.05 1.05 0 0 1-.9 1.6H6.9a1.05 1.05 0 0 1-.9-1.6z" fill="#FFFFFF"/> <path d="M12 10v2.7" stroke="#7B55FF" stroke-width="1.8" stroke-linecap="round"/> <circle cx="12" cy="14.7" r="1.05" fill="#7B55FF"/>' },
  { code: ':ms-ohen:', label: 'Frčí to', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <path d="M12 3.9c-.4 2.5-2 3.8-3.4 5.3-1.3 1.4-2.2 2.9-2.2 4.8a5.6 5.6 0 0 0 11.2 0c0-2.5-1.6-4.5-3.3-6.1.2 1.3-.2 2.3-1 3.1.7-2.5-.1-5-1.3-7.1z" fill="#1FDF67"/> <path d="M12 11.3c1.4 1.2 2.2 2.3 2.2 3.5a2.2 2.2 0 0 1-4.4 0c0-1.2.8-2.3 2.2-3.5z" fill="#7B55FF"/>' },
  { code: ':ms-mikrofon:', label: 'Natáčíme', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <rect x="9.3" y="4.2" width="5.4" height="9.4" rx="2.7" fill="#FFFFFF"/> <path d="M7 12.4c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none"/> <path d="M12 17.4v2" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>' },
  { code: ':ms-srdce:', label: 'Srdce', svg: '<circle cx="12" cy="12" r="11" fill="#7B55FF"/> <path d="M12 18.4l-5.6-5.2c-1.8-1.7-1.7-4.5.2-5.9 1.6-1.2 3.9-.8 5.1.8l.3.4.3-.4c1.2-1.6 3.5-2 5.1-.8 1.9 1.4 2 4.2.2 5.9z" fill="#1FDF67"/>' },
];

const PODLE_KODU = new Map(MS_SMAJLICI.map((s) => [s.code, s]));

/** Smajlík podle zkratky; neznámá zkratka vrací undefined a zůstane textem. */
export function najdiSmajlika(code: string): MsSmajlik | undefined {
  return PODLE_KODU.get(code);
}

/**
 * Vzor pro rozdělení textu zprávy. Zachytává i zkratky, které v sadě nejsou -
 * ty se pak vypíšou jako obyčejný text, ať se nic neztratí.
 */
export const MS_SMAJLIK_REGEX = /(:ms-[a-z-]+:)/g;
