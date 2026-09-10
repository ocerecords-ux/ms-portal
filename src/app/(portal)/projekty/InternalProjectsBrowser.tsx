'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  InternalProjectsTable,
  compareProjects,
  type InternalProject,
  type ProjectSort,
  type ProjectSortKey,
} from './shared';
import { projectTypeLabel } from '@/lib/projectTypes';
import { PROJECTS_TABLE_KEY, visibleColumns, type ColumnSetting } from '@/lib/columnLabels';

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
  columns,
  canEditLabels,
  canEditStatus,
  novyProjekt,
  manazeri,
  herci,
}: {
  active: InternalProject[];
  finished: InternalProject[];
  /** Vysvetleni pro zalozku Dokoncene, kdyz se dokoncene projekty netahaji. */
  finishedNote?: string;
  /** Sloupce tabulky - vychozi podoba prepsana tim, co je ulozene. */
  columns: ColumnSetting[];
  /** Upravovat sloupce smi jen Zuzo-labuzo. */
  canEditLabels?: boolean;
  /** Prehazovat stav projektu smi Produkce a Zuzo-labuzo (zadani 10. 9. 2026). */
  canEditStatus?: boolean;
  /**
   * Zakladani projektu. Sedi vedle hledani, ne nad tabulkou - samostatny
   * radek jen kvuli jednomu tlacitku je plytvani mistem (zadani 10. 9. 2026).
   */
  novyProjekt?: React.ReactNode;
  /** Manazeri do rozbalovaciho seznamu primo v prehledu (zadani 10. 9. 2026). */
  manazeri?: { id: string; label: string }[];
  /** Herci do vyberu primo v prehledu (zadani 10. 9. 2026). */
  herci?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  // Uprava sloupcu primo v tabulce - tri tecky ve fialove liste, prejmenovani,
  // pretahovani a krizek, uplne stejne jako u horni listy portalu
  // (zadani 8. 9. 2026, rozsireno 9. 9. 2026).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ColumnSetting[]>(columns);
  const [saving, setSaving] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(columns);
  }, [columns, editing]);

  // Tlacitka rezimu uprav. Vykresluji se v liste NAD tabulkou (viz vyse) -
  // v hlavicce tabulky utikala mimo obraz, jakmile se sloupce roztahly.
  const editAkce = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <button
        type="button"
        onClick={saveLabels}
        disabled={saving}
        className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-4 py-1.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
      >
        {saving ? 'Ukládám…' : 'Hotovo'}
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(columns);
          setEditing(false);
          setLabelError(null);
        }}
        className="text-xs font-heading text-brand-purpleDark hover:underline"
      >
        Zrušit
      </button>
      <button
        type="button"
        onClick={resetLabels}
        disabled={saving}
        className="text-xs font-heading text-brand-purpleDark hover:underline disabled:opacity-60"
      >
        Obnovit výchozí
      </button>
    </span>
  );

  const zobrazene = visibleColumns(editing ? draft : columns);
  const skryte = (editing ? draft : columns).filter((c) => c.hidden);

  function prejmenuj(key: string, label: string) {
    setDraft((cols) => cols.map((c) => (c.key === key ? { ...c, label } : c)));
  }

  /** Pretazeni: indexy prichazi z VIDITELNYCH sloupcu, prerovnava se cely seznam. */
  function presun(from: number, to: number) {
    setDraft((cols) => {
      const vid = cols.filter((c) => !c.hidden);
      const klicZ = vid[from]?.key;
      const klicNa = vid[to]?.key;
      if (!klicZ || !klicNa || klicZ === klicNa) return cols;
      const taheny = cols.find((c) => c.key === klicZ)!;
      const bez = cols.filter((c) => c.key !== klicZ);
      const cil = bez.findIndex((c) => c.key === klicNa);
      const kam = from < to ? cil + 1 : cil;
      const kopie = [...bez];
      kopie.splice(kam, 0, taheny);
      return kopie;
    });
  }

  function skryj(key: string) {
    setLabelError(null);
    setDraft((cols) => {
      // Prazdna tabulka nedava smysl - posledni sloupec nejde odebrat.
      if (cols.filter((c) => !c.hidden).length <= 1) {
        setLabelError('Aspoň jeden sloupec musí zůstat zobrazený.');
        return cols;
      }
      return cols.map((c) => (c.key === key ? { ...c, hidden: true } : c));
    });
  }

  function vrat(key: string) {
    setLabelError(null);
    setDraft((cols) => cols.map((c) => (c.key === key ? { ...c, hidden: false } : c)));
  }

  async function saveLabels() {
    setSaving(true);
    setLabelError(null);
    try {
      const res = await fetch('/api/admin/column-labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableKey: PROJECTS_TABLE_KEY, columns: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLabelError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setLabelError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function resetLabels() {
    setSaving(true);
    setLabelError(null);
    try {
      const res = await fetch(`/api/admin/column-labels?tableKey=${PROJECTS_TABLE_KEY}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLabelError(data?.error || 'Obnovení se nezdařilo.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setLabelError('Obnovení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }
  // Razeni klikem na nadpis sloupce (zadani 5. 9. 2026). Vychozi je stejne
  // jako driv - podle terminu, resp. data dokonceni.
  const [sort, setSort] = useState<ProjectSort>({ key: 'endDate', dir: 'desc' });

  function handleSort(key: ProjectSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'endDate' || key === 'releaseDate' || key === 'pageCount' || key === 'priority' ? 'desc' : 'asc' },
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
                  isActive ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label} <span className="tabular-nums">({t.count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-3 mb-2 flex-wrap">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Hledat projekt, firmu, manažera…"
              className="w-72 max-w-full rounded-lg border border-line bg-surface pl-9 pr-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
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
          {novyProjekt}
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-2">
          {/* Hotovo / Zrušit patří SEM, ne do hlavičky tabulky. V režimu úprav
              se sloupce roztáhnou, tabulka přeteče do stran a tlačítka
              v posledním sloupci skončila mimo obraz - z úprav pak nebylo jak
              vyjet ani je uložit (zpráva uživatele 9. 9. 2026: "když to dám
              editovat, tak se to pak nedá uložit ani z toho vyjet"). Lišta nad
              tabulkou je vidět vždycky, ať je tabulka jakkoliv široká. */}
          <div className="flex items-center gap-3 flex-wrap rounded-card border border-brand-purple bg-tint px-3 py-2">
            <p className="text-xs font-body text-brand-purpleDark m-0 flex-1 min-w-[220px]">
              Název přepište přímo v hlavičce, pořadí změníte přetažením, křížkem sloupec odeberete.
              Změna platí pro všechny.
            </p>
            {editAkce}
          </div>
          {skryte.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-body text-muted">Odebrané sloupce:</span>
              {skryte.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => vrat(c.key)}
                  title={`Vrátit ${c.label}`}
                  className="inline-flex items-center gap-1 rounded-pill border border-brand-purple bg-surface px-3 py-1 text-xs font-heading font-semibold text-brand-purple hover:bg-tint transition-colors"
                >
                  + {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {labelError && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{labelError}</p>
      )}

      <InternalProjectsTable
        sort={sort}
        onSort={handleSort}
        projects={visible}
        columns={zobrazene}
        editing={editing}
        canEditColumns={canEditLabels}
        canEditStatus={canEditStatus}
        manazeri={manazeri}
        herci={herci}
        onStartEditing={() => {
          setDraft(columns);
          setEditing(true);
          setLabelError(null);
        }}
        onLabelChange={prejmenuj}
        onMoveColumn={presun}
        onHideColumn={skryj}
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
                className="bg-surface border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-40"
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
                className="bg-surface border border-line text-ink font-heading font-semibold text-xs rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-40"
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
