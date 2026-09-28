'use client';

import { useEffect, useState } from 'react';

/**
 * Záložky na detailu projektu (zprava uzivatele 8. 9. 2026: "u projektu už to
 * začíná být trochu nepřehledné... Natáčecí frekvence a doklady by mohly být
 * nahoře v záložce").
 *
 * Obsah záložek je vykreslený na serveru a sem přijde hotový — přepínání je
 * tedy okamžité a nic se znovu nenačítá. Prázdné záložky se vůbec nezobrazí,
 * takže klient ani zvukař nevidí nabídku, kam nemá co koukat.
 *
 * ZÁLOŽKA JDE OTEVŘÍT ROVNOU Z ADRESY (zadání 28. 9. 2026: „potřebuju se
 * dostat v tom samém okně a na kartu Přeposlech v detailu projektu").
 * `/projekty/<id>?zalozka=preposlech` otevře rovnou přeposlech. Odkazy na to
 * mířily už dřív - z náhledu u ikony AudioTaggeru v seznamu projektů a
 * z e-mailů - jenže tenhle komponent parametr nečetl a vždycky začínal
 * na první záložce.
 *
 * Adresa se drží i při ručním přepnutí (replaceState, ne push - ať se
 * tlačítkem zpět vrací na předchozí STRÁNKU a ne po jedné záložce).
 */
export type ProjectTab = {
  key: string;
  label: string;
  /** Číslo za názvem záložky — kolik je uvnitř položek. */
  count?: number;
  content: React.ReactNode;
};

/** Název záložky z adresy, když taková záložka opravdu existuje. */
function zalozkaZAdresy(tabs: ProjectTab[]): string | null {
  if (typeof window === 'undefined') return null;
  const chtena = new URLSearchParams(window.location.search).get('zalozka');
  return chtena && tabs.some((t) => t.key === chtena) ? chtena : null;
}

export function ProjectTabs({ tabs }: { tabs: ProjectTab[] }) {
  const [aktivni, setAktivni] = useState(tabs[0]?.key ?? '');

  /**
   * Čte se až po vykreslení, ne v initializeru - na serveru adresa není
   * a React by si stěžoval, že se vykreslení neshoduje.
   */
  useEffect(() => {
    const zAdresy = zalozkaZAdresy(tabs);
    if (zAdresy) setAktivni(zAdresy);
    // Záměrně jen při prvním vykreslení: později už o záložce rozhoduje klik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const otevrena = tabs.find((t) => t.key === aktivni) ?? tabs[0];

  const prepni = (klic: string) => {
    setAktivni(klic);
    if (typeof window === 'undefined') return;
    const adresa = new URL(window.location.href);
    // Přehled je výchozí - v adrese pak nemá co dělat.
    if (klic === tabs[0]?.key) adresa.searchParams.delete('zalozka');
    else adresa.searchParams.set('zalozka', klic);
    window.history.replaceState(null, '', adresa.toString());
  };

  if (tabs.length === 0) return null;
  if (tabs.length === 1) return <>{tabs[0].content}</>;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1 flex-wrap border-b border-line">
        {tabs.map((tab) => {
          const active = tab.key === otevrena?.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => prepni(tab.key)}
              aria-current={active ? 'page' : undefined}
              className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                active
                  ? 'bg-surface border-line text-brand-purple'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-8">{otevrena?.content}</div>
    </div>
  );
}
