/**
 * STAV NABÍDKY U REKLAM (zadání 23. 9. 2026: „chtěl bych někde vidět (jen já)
 * v přehledu i v detailu projektu, že je nabídka schválena. Jen u reklam.
 * Stačí nějaký symbol, ať je to jednoduché").
 *
 * Tři stavy a nic víc: čeká na schválení / schválena / neschválena. Je to
 * ruční značka - nabídku posíláme mailem mimo portál, takže se nemá odkud
 * dozvědět sama.
 *
 * KDO JI VIDÍ, se zaškrtává na kartě uživatele (User.nabidkyReklam). Zapnuté
 * to má zatím jen Ondřej - proto příznak, a ne role: až to bude hlídat někdo
 * další, překlikne se to tam a nikde se nesahá do kódu.
 *
 * SOUBOR JE BEZ PRISMY, ať ho můžou brát přehled (tabulka) i detail a značka
 * vypadala na obou místech stejně.
 */

export type StavNabidky = 'CEKA' | 'SCHVALENA' | 'NESCHVALENA';

export const STAVY_NABIDKY: { klic: StavNabidky; popis: string; barva: string }[] = [
  { klic: 'CEKA', popis: 'Nabídka čeká na schválení', barva: '#f59e0b' },
  { klic: 'SCHVALENA', popis: 'Nabídka schválena', barva: '#16a34a' },
  { klic: 'NESCHVALENA', popis: 'Nabídka neschválena', barva: '#ef4444' },
];

/**
 * Co je v databázi → stav. Prázdno je „čeká": u reklamy nabídka vždycky
 * někde je, jen u ní ještě nikdo neklikl.
 */
export function stavNabidky(ulozeno: string | null | undefined): StavNabidky {
  if (ulozeno === 'SCHVALENA' || ulozeno === 'NESCHVALENA') return ulozeno;
  return 'CEKA';
}

export function popisNabidky(stav: StavNabidky): string {
  return STAVY_NABIDKY.find((s) => s.klic === stav)?.popis ?? '';
}

export function barvaNabidky(stav: StavNabidky): string {
  return STAVY_NABIDKY.find((s) => s.klic === stav)?.barva ?? '#f59e0b';
}

/**
 * Symbol do řádku. Kolečko v barvě stavu: hodiny / fajfka / křížek. Bez
 * textu - v přehledu na něj není místo a v bublince je napsaný celý.
 */
export function ZnackaNabidky({
  stav,
  velikost = 16,
}: {
  stav: StavNabidky;
  velikost?: number;
}) {
  const barva = barvaNabidky(stav);
  return (
    <span
      title={popisNabidky(stav)}
      aria-label={popisNabidky(stav)}
      className="inline-grid place-items-center shrink-0 rounded-full"
      style={{
        width: velikost,
        height: velikost,
        background: `${barva}22`,
        border: `1px solid ${barva}`,
        color: barva,
      }}
    >
      <svg
        width={Math.round(velikost * 0.62)}
        height={Math.round(velikost * 0.62)}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {stav === 'SCHVALENA' && <path d="M2.5 6.4 L4.8 8.7 L9.5 3.6" />}
        {stav === 'NESCHVALENA' && (
          <>
            <path d="M3 3 L9 9" />
            <path d="M9 3 L3 9" />
          </>
        )}
        {stav === 'CEKA' && (
          <>
            <circle cx="6" cy="6" r="4.2" />
            <path d="M6 3.4 V6 L7.9 7.2" />
          </>
        )}
      </svg>
    </span>
  );
}
