import { prelozit, type Jazyk } from '@/lib/jazyk';

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

export type StavNabidky = 'NENI' | 'CEKA' | 'SCHVALENA' | 'NESCHVALENA';

export const STAVY_NABIDKY: { klic: StavNabidky; popis: string; barva: string }[] = [
  // „NENÍ VYTVOŘENA" JE VÝCHOZÍ STAV (oprava 19. 11. 2026: „tady to lže.
  // Nabídka není založena, takže nemůže čekat na schválení"). Do té doby se
  // prázdná značka ukazovala jako „čeká na schválení" - u projektu, kde ještě
  // žádná nabídka nevznikla, to bylo tvrzení o něčem, co neexistuje.
  { klic: 'NENI', popis: 'Nabídka není vytvořena', barva: '#9ca3af' },
  { klic: 'CEKA', popis: 'Nabídka čeká na schválení', barva: '#f59e0b' },
  { klic: 'SCHVALENA', popis: 'Nabídka schválena', barva: '#16a34a' },
  { klic: 'NESCHVALENA', popis: 'Nabídka neschválena', barva: '#ef4444' },
];

/**
 * Co je v databázi → stav. PRÁZDNO ZNAMENÁ „NENÍ VYTVOŘENA" (19. 11. 2026),
 * ne „čeká na schválení": dokud nabídka nevznikla, nemá na co čekat. Na
 * „čeká" si ji překlopí ten, kdo ji klientovi poslal.
 */
export function stavNabidky(ulozeno: string | null | undefined): StavNabidky {
  if (ulozeno === 'SCHVALENA' || ulozeno === 'NESCHVALENA' || ulozeno === 'CEKA') return ulozeno;
  return 'NENI';
}

/** Čeština ze `STAVY_NABIDKY` je zdroj pravdy, angličtina ze slovníku podle kódu. */
export function popisNabidky(stav: StavNabidky, jazyk?: Jazyk): string {
  if (jazyk && jazyk !== 'cs') return prelozit(jazyk, `nabidkaReklamy.${stav}`);
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
  /** Jazyk propem - značku bere tabulka na serveru i detail v prohlížeči (pravidlo 8). */
  jazyk,
}: {
  stav: StavNabidky;
  velikost?: number;
  jazyk?: Jazyk;
}) {
  const barva = barvaNabidky(stav);
  const popis = popisNabidky(stav, jazyk);
  return (
    <span
      title={popis}
      aria-label={popis}
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
        {/* Není vytvořena: prázdné kolečko s pomlčkou - nic se neděje. */}
        {stav === 'NENI' && (
          <>
            <circle cx="6" cy="6" r="4.2" strokeDasharray="2 1.6" />
            <path d="M4.2 6 H7.8" />
          </>
        )}
      </svg>
    </span>
  );
}
