/**
 * Ikony do hlavní fialové lišty (zadání 15. 9. 2026: „pojďme ještě navrhnout
 * nějaké ikony na hlavní nabídku na hlavní fialový panel. Měly by být zelené
 * a nad tím nápisem"). Z nabídnutých tří návrhů si uživatel vybral trojku -
 * „Linka s akcentem": celá ikona je tenká zelená linka a jeden jediný detail
 * je vyplněný - vždycky ten, který položku odlišuje (prostřední vlna
 * u Nahrávek, ručička u Výkazů, hlava u Uživatelů).
 *
 * Kreslí se do čtverce 24×24, takže jde libovolně zvětšovat. Barva se bere
 * z `currentColor`, aby si ji lišta určila jednou třídou.
 */

import type { ReactNode } from 'react';

/** Tenká linka - obrys ikony. */
const obrys = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Jediný vyplněný detail - to, čím se položka pozná. */
const akcent = { fill: 'currentColor', stroke: 'none' };

/** Adresa odkazu → kresba. Co tu není, se vykreslí bez ikony. */
const KRESBY: Record<string, ReactNode> = {
  // Projekty - složka s vyplněným štítkem.
  '/projekty': (
    <>
      <path {...obrys} d="M3 7.5a2 2 0 0 1 2-2h3.6l1.6 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <rect {...akcent} x="6.6" y="12" width="7" height="2" rx="1" />
    </>
  ),
  // Objednávka - papír s vyplněným puntíkem.
  '/objednavka': (
    <>
      <path {...obrys} d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
      <path {...obrys} d="M14 3.5v4h4" />
      <circle {...akcent} cx="12" cy="14.2" r="2.6" />
    </>
  ),
  // Nahrávky - vlna, plná je ta prostřední.
  '/nahravky': (
    <>
      <path {...obrys} d="M3 12h2M7 8.5v7M15 8.5v7M19 12h2" />
      <rect {...akcent} x="10.7" y="3.6" width="2.6" height="16.8" rx="1.3" />
    </>
  ),
  // Výkazy - hodiny s plnou ručičkovou osou.
  '/vykazy': (
    <>
      <circle {...obrys} cx="12" cy="12" r="8.5" />
      <path {...obrys} d="M12 7.6V12l3 1.8" />
      <circle {...akcent} cx="12" cy="12" r="1.7" />
    </>
  ),
  // Kalendář - měsíc s jedním vybarveným dnem.
  '/kalendar': (
    <>
      <rect {...obrys} x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path {...obrys} d="M3.5 10h17M8 3.5v3M16 3.5v3" />
      <rect {...akcent} x="6.6" y="12.4" width="4" height="4" rx="1.2" />
    </>
  ),
  // Moje termíny - stejný list, ale vybarvený den je jen jeden a kulatý.
  '/moje-terminy': (
    <>
      <rect {...obrys} x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path {...obrys} d="M3.5 10h17M8 3.5v3M16 3.5v3" />
      <circle {...akcent} cx="12" cy="15" r="2.4" />
    </>
  ),
  // Honoráře (19. 9. 2026: „ikonku s nějakými penězi") - bankovka
  // a před ní plná mince.
  '/honorare': (
    <>
      <rect {...obrys} x="2.5" y="6" width="15" height="9.5" rx="1.8" />
      <circle {...obrys} cx="10" cy="10.75" r="2.1" />
      <circle {...akcent} cx="17" cy="16.5" r="4.2" />
    </>
  ),
  // Firmy - dům s vyplněnými okny.
  '/admin': (
    <>
      <path {...obrys} d="M4 20.5V6a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 6v14.5" />
      <path {...obrys} d="M14 10h4.5A1.5 1.5 0 0 1 20 11.5v9M2.5 20.5h19" />
      <rect {...akcent} x="6.6" y="8" width="4.8" height="1.9" rx=".95" />
      <rect {...akcent} x="6.6" y="11.6" width="4.8" height="1.9" rx=".95" />
    </>
  ),
  // Uživatelé - dva lidi, plná je hlava toho předního.
  '/admin/users': (
    <>
      <path {...obrys} d="M3.5 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path {...obrys} d="M16.5 6.4a3.2 3.2 0 0 1 0 5.8M18 14.6c1.6.8 2.6 2.3 2.6 4.4" />
      <circle {...akcent} cx="9.5" cy="8.5" r="3.5" />
    </>
  ),
  // Ceníky - visačka s plnou dírkou.
  '/admin/ceniky': (
    <>
      <path
        {...obrys}
        d="M11.4 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.6a2 2 0 0 1-.6 1.4l-6.4 6.4a2 2 0 0 1-2.8 0l-6.6-6.6a2 2 0 0 1 0-2.8L10.5 4a2 2 0 0 1 .9-.5z"
      />
      <circle {...akcent} cx="16" cy="8" r="1.7" />
    </>
  ),
  // Doklady - účtenka s jednou plnou řádkou.
  '/admin/doklady': (
    <>
      <path {...obrys} d="M5 3.5h14v17l-2.3-1.6-2.3 1.6-2.4-1.6-2.3 1.6L7.3 19 5 20.5z" />
      <rect {...akcent} x="8.6" y="7.6" width="6.8" height="1.9" rx=".95" />
      <path {...obrys} d="M9 12.6h6" />
    </>
  ),
  // Studia - mikrofon, plné je tělo.
  '/admin/studia': (
    <>
      <rect {...akcent} x="9.4" y="2.8" width="5.2" height="10" rx="2.6" />
      <path {...obrys} d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v3.2M8.6 20.6h6.8" />
    </>
  ),
  // Zprávy portálu - obálka s plným puntíkem (něco odešlo).
  '/admin/zpravy-portalu': (
    <>
      <rect {...obrys} x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path {...obrys} d="m3.6 7 8.4 6 8.4-6" />
      <circle {...akcent} cx="18.6" cy="6.4" r="2.6" />
    </>
  ),
  // Vzory zpráv - bublina s plným prostředním puntíkem.
  '/admin/vzory-zprav': (
    <>
      <path {...obrys} d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5L5.5 20v-4H6a2 2 0 0 1-2-2z" />
      <circle {...akcent} cx="12" cy="10" r="1.6" />
    </>
  ),
  // Archiv - krabice s plným víkem.
  '/admin/archiv': (
    <>
      <rect {...akcent} x="3" y="4.5" width="18" height="4" rx="1.4" />
      <path {...obrys} d="M4.6 9.5h14.8v9a2 2 0 0 1-2 2H6.6a2 2 0 0 1-2-2z" />
      <path {...obrys} d="M10 13.5h4" />
    </>
  ),
  // Můj účet - jeden člověk, plná hlava.
  '/muj-ucet': (
    <>
      <circle {...akcent} cx="12" cy="8" r="3.6" />
      <path {...obrys} d="M4.8 20.2c0-3.7 3.2-6.1 7.2-6.1s7.2 2.4 7.2 6.1" />
    </>
  ),
};

/** Náhradní kresba pro vlastní odkazy „mimo portál" - ať mají všechny
 *  položky v liště stejnou výšku. */
const NAHRADNI: ReactNode = (
  <>
    <circle {...obrys} cx="12" cy="12" r="8.5" />
    <circle {...akcent} cx="12" cy="12" r="2.2" />
  </>
);

/** Ikona k odkazu v liště. */
export function IkonaListy({ href, className }: { href: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      {KRESBY[href] ?? NAHRADNI}
    </svg>
  );
}
