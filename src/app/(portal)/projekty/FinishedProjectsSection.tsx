'use client';

import { useState } from 'react';
import type { DisplayProject } from '@/lib/projektyTypy';
import { ProjectsTable } from './shared';
import { useJazyk, usePreklad } from '../components/JazykProvider';

const PAGE_SIZE = 20;

// Dokoncene projekty jsou pri prvnim vstupu do sekce schovane (klienta
// typicky zajimaji hlavne ty aktivni) a po rozbaleni se nacitaji po
// strankach po 20 zaznamech, aby tabulka u klientu s dlouhou historii
// nebyla nekonecne dlouha - tlacitko "Dalsi projekty" pokazde odkryje
// dalsich 20.
export function FinishedProjectsSection({
  projects,
  rodneListy,
  normostrany = true,
}: {
  projects: DisplayProject[];
  /** Rodné listy k projektům - viz ProjectsTable (zadání 9. 9. 2026). */
  rodneListy?: Record<string, { id: string; fileName: string }>;
  /** U reklamního klienta se sloupec NS nevykresluje (25. 9. 2026). */
  normostrany?: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('projekty.dokoncene')}
        </h2>
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
          className="bg-surface border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors"
        >
          {expanded
            ? t('projekty.skrytDokoncene')
            : t('projekty.zobrazitDokoncene', { pocet: projects.length })}
        </button>
      </div>

      {expanded && (
        <>
          <ProjectsTable
            projects={projects.slice(0, visibleCount)}
            emptyText={t('projekty.zadneDokoncene')}
            rodneListy={rodneListy}
            jazyk={jazyk}
            normostrany={normostrany}
          />
          {visibleCount < projects.length && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="bg-bar text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDark transition-colors"
              >
                {t('projekty.dalsi')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
