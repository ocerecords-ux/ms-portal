'use client';

import { useState } from 'react';
import type { DisplayProject } from '@/lib/projektyTypy';
import { ProjectsTable } from './shared';

const PO_KOLIKA = 20;

/**
 * DOKONČENÉ ZAKÁZKY CELÉ FIRMY (zadání 24. 9. 2026: záložka „Celá firma"
 * a k ní „u těch projektů firmy by mohly být ještě identifikované kolegyně").
 *
 * Schválně samostatná komponenta, ne další prop do FinishedProjectsSection:
 * ta patří „mým" projektům a zbytečně by jí přibývaly přepínače pro případ,
 * který se jí netýká. Chování je stejné - napřed schované, po rozbalení po
 * dvaceti záznamech, ať tabulka u firmy s dlouhou historií nesahá do sklepa.
 */
export function DokonceneFirmy({
  projects,
  rodneListy,
  kontakty,
}: {
  projects: DisplayProject[];
  rodneListy?: Record<string, { id: string; fileName: string }>;
  /** Kdo zakázku u klienta vede - viz ProjectsTable. */
  kontakty?: Record<string, string>;
}) {
  const [rozbaleno, setRozbaleno] = useState(false);
  const [kolik, setKolik] = useState(PO_KOLIKA);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Dokončené projekty
        </h2>
        <button
          type="button"
          onClick={() => {
            setRozbaleno((v) => !v);
            setKolik(PO_KOLIKA);
          }}
          className="bg-surface border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors"
        >
          {rozbaleno ? 'Skrýt dokončené projekty' : `Zobrazit dokončené projekty (${projects.length})`}
        </button>
      </div>

      {rozbaleno && (
        <>
          <ProjectsTable
            projects={projects.slice(0, kolik)}
            emptyText="Vaše firma u nás zatím nemá žádnou dokončenou zakázku."
            rodneListy={rodneListy}
            kontakty={kontakty}
          />
          {kolik < projects.length && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => setKolik((c) => c + PO_KOLIKA)}
                className="bg-bar text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDark transition-colors"
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
