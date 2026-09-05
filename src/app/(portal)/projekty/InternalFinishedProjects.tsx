'use client';

import { useState } from 'react';
import { InternalProjectsTable, type InternalProject } from './shared';

const PAGE_SIZE = 20;

/**
 * Dokoncene projekty v internim prehledu (zadani 5. 9. 2026: "Rozdělit na
 * aktivní a dokončené"). Stejne chovani jako klientska
 * FinishedProjectsSection - schovane, po rozbaleni po 20 zaznamech - jen nad
 * interni tabulkou s prioritou/typem/manazerem.
 */
export function InternalFinishedProjects({ projects }: { projects: InternalProject[] }) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Dokončené projekty
        </h2>
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
          className="bg-white border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors"
        >
          {expanded ? 'Skrýt dokončené projekty' : `Zobrazit dokončené projekty (${projects.length})`}
        </button>
      </div>

      {expanded && (
        <>
          <InternalProjectsTable
            projects={projects.slice(0, visibleCount)}
            emptyText="Zatím tu nejsou žádné dokončené projekty."
          />
          {visibleCount < projects.length && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="bg-ink text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDark transition-colors"
              >
                Další projekty
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
