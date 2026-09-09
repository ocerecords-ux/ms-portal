'use client';

import { useState } from 'react';

/**
 * Záložky na detailu projektu (zprava uzivatele 8. 9. 2026: "u projektu už to
 * začíná být trochu nepřehledné... Natáčecí frekvence a doklady by mohly být
 * nahoře v záložce").
 *
 * Obsah záložek je vykreslený na serveru a sem přijde hotový — přepínání je
 * tedy okamžité a nic se znovu nenačítá. Prázdné záložky se vůbec nezobrazí,
 * takže klient ani zvukař nevidí nabídku, kam nemá co koukat.
 */
export type ProjectTab = {
  key: string;
  label: string;
  /** Číslo za názvem záložky — kolik je uvnitř položek. */
  count?: number;
  content: React.ReactNode;
};

export function ProjectTabs({ tabs }: { tabs: ProjectTab[] }) {
  const [aktivni, setAktivni] = useState(tabs[0]?.key ?? '');
  const otevrena = tabs.find((t) => t.key === aktivni) ?? tabs[0];

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
              onClick={() => setAktivni(tab.key)}
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
