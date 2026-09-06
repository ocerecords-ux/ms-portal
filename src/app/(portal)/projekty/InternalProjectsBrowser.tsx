'use client';

import { useMemo, useState } from 'react';
import {
  InternalProjectsTable,
  compareProjects,
  type InternalProject,
  type ProjectSort,
  type ProjectSortKey,
} from './shared';
import { projectTypeLabel } from '@/lib/projectTypes';

// Zadani 5. 9. 2026: "Na stránce bude max. padesát aktivních projektů. Nahoře
// budou dvě záložky, kde se bude přepínat mezi projekty Aktivní a Dokončené.
// Pak bych tam dal určitě hledání v projektech."
const PAGE_SIZE = 50;

type Tab = 'active' | 'finished';

function matches(p: InternalProject, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    p.name,
    p.companyName,
    p.statusName,
    p.narrator ?? '',
    p.meta?.managerName ?? '',
    projectTypeLabel(p.meta?.projectType) ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function InternalProjectsBrowser({
  active,
  finished,
  finishedNote,
}: {
  active: InternalProject[];
  finished: InternalProject[];
  /** Vysvetleni pro zalozku Dokoncene, kdyz se dokoncene projekty netahaji. */
  finishedNote?: string;
}) {
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  // Razeni klikem na nadpis sloupce (zadani 5. 9. 2026). Vychozi je stejne
  // jako driv - podle terminu, resp. data dokonceni.
  const [sort, setSort] = useState<ProjectSort>({ key: 'finishedAt', dir: 'desc' });

  function handleSort(key: ProjectSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'finishedAt' || key === 'pageCount' || key === 'priority' ? 'desc' : 'asc' },
    );
    setPage(0);
  }

  const source = tab === 'active' ? active : finished;
  const filtered = useMemo(() => {
    const rows = source.filter((p) => matches(p, query.trim()));
    return rows.sort((a, b) => compareProjects(a, b, sort));
  }, [source, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function switchTab(next: Tab) {
    setTab(next);
    setPage(0);
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Aktivní', count: active.length },
    { key: 'finished', label: 'Dokončené', count: finished.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
        <div className="flex items-center gap-1">
          {tabs.map((t) => {
            const isActive = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                  isActive ? 'bg-white border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label} <span className="tabular-nums">({t.count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative mb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Hledat projekt, firmu, manažera…"
            className="w-72 max-w-full rounded-lg border border-line bg-white pl-9 pr-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </div>
      </div>

      <InternalProjectsTable
        sort={sort}
        onSort={handleSort}
        projects={visible}
        emptyText={
          query
            ? 'Hledání nic nenašlo.'
            : tab === 'active'
              ? 'Aktuálně nejsou žádné rozpracované projekty.'
              : (finishedNote ?? 'Zatím tu nejsou žádné dokončené projekty.')
        }
      />

      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs font-body text-muted">
            Zobrazeno {currentPage * PAGE_SIZE + 1}–{currentPage * PAGE_SIZE + visible.length} z{' '}
            <span className="tabular-nums">{filtered.length}</span>
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="bg-white border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-40"
              >
                ← Předchozí
              </button>
              <span className="text-xs font-heading text-muted tabular-nums">
                {currentPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
                className="bg-white border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-40"
              >
                Další →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
