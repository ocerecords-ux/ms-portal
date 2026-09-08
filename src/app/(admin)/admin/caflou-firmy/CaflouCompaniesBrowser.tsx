'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CaflouContactKind } from '@prisma/client';
import {
  CONTACT_KIND_CLASSES,
  CONTACT_KIND_LABELS,
  CONTACT_KIND_OPTIONS,
} from '@/lib/caflouCompanies';

export type CaflouCompanyRow = {
  id: string;
  name: string;
  ic: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  kind: CaflouContactKind;
  /** Nalezena shoda s tim, co uz v portalu je - kvuli duplicitam. */
  existing: { label: string; where: string } | null;
};

type Filter = 'vse' | CaflouContactKind | 'duplicity';

/**
 * Firmy z Caflou k roztrideni (zadani 8. 9. 2026: "jsou tam najednou klienti
 * i herci, to bychom si roztridili").
 *
 * Import bezi po strankach z prohlizece - jeden pozadavek pres cely ucet by
 * na serveru vyprsel. Nic se nezaklada do Firem ani k Uzivatelum, takze
 * import nemuze vyrobit duplicitu; u kazdeho radku je naopak videt, jestli uz
 * neco takoveho v portalu je.
 */
export function CaflouCompaniesBrowser({ items }: { items: CaflouCompanyRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('vse');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { vse: items.length, duplicity: 0 };
    for (const kind of CONTACT_KIND_OPTIONS) map[kind] = 0;
    for (const item of items) {
      map[item.kind] = (map[item.kind] ?? 0) + 1;
      if (item.existing) map.duplicity += 1;
    }
    return map;
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'duplicity' ? !item.existing : filter !== 'vse' && item.kind !== filter) return false;
      if (!needle) return true;
      const haystack = [item.name, item.ic ?? '', item.email ?? '', item.phone ?? '', item.city ?? '']
        .join(' ')
        .toLowerCase();
      return needle.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
    });
  }, [items, filter, query]);

  async function runImport() {
    setImporting(true);
    setError(null);
    setProgress('Načítám z Caflou…');
    try {
      let page: number | null = 1;
      let total = 0;
      // Pojistka proti nekonecne smycce, kdyby Caflou parametr page ignorovalo.
      for (let guard = 0; page !== null && guard < 60; guard += 1) {
        const res = await fetch('/api/admin/caflou-firmy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || 'Import se nezdařil.');
          return;
        }
        total += Number(data?.ulozeno ?? 0);
        setProgress(`Načteno ${total} firem…`);
        page = data?.dalsiStranka ?? null;
      }
      setProgress(`Hotovo — načteno ${total} firem.`);
      router.refresh();
    } catch {
      setError('Import se nezdařil.');
    } finally {
      setImporting(false);
    }
  }

  async function setKind(id: string, kind: CaflouContactKind) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/caflou-firmy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        setError('Uložení se nezdařilo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'vse', label: 'Vše' },
    { key: 'NEZARAZENO', label: CONTACT_KIND_LABELS.NEZARAZENO },
    { key: 'KLIENT', label: CONTACT_KIND_LABELS.KLIENT },
    { key: 'HEREC', label: CONTACT_KIND_LABELS.HEREC },
    { key: 'IGNOROVAT', label: CONTACT_KIND_LABELS.IGNOROVAT },
    { key: 'duplicity', label: 'Už v portálu' },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink m-0">Firmy z Caflou</h1>
          <p className="text-muted text-sm mt-1 font-body max-w-2xl">
            Surový seznam z Caflou — klienti i herci dohromady. Označte u každého, o koho jde; do Firem
            ani k Uživatelům se zatím nic nezakládá, takže tu nemůže vzniknout duplicita. Co už v
            portálu je, je označené.
          </p>
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={runImport}
            disabled={importing}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            {importing ? 'Načítám…' : items.length === 0 ? 'Načíst z Caflou' : 'Načíst znovu'}
          </button>
          {progress && <p className="text-xs font-body text-muted m-0 mt-1.5">{progress}</p>}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                  active ? 'bg-white border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {tab.label} ({counts[tab.key] ?? 0})
              </button>
            );
          })}
        </div>
        <div className="mb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat název, IČ, e-mail…"
            className="w-64 max-w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
          />
        </div>
      </div>

      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-brand-purple text-white font-heading text-xs">
                <th className="text-left px-3 py-3.5">Název</th>
                <th className="text-left px-3 py-3.5 whitespace-nowrap">IČ</th>
                <th className="text-left px-3 py-3.5">Kontakt</th>
                <th className="text-left px-3 py-3.5">Město</th>
                <th className="text-left px-3 py-3.5 whitespace-nowrap">Už v portálu</th>
                <th className="text-left px-3 py-3.5 whitespace-nowrap">Kdo to je</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm font-body">
                    {items.length === 0
                      ? 'Zatím tu nic není — načtěte firmy z Caflou tlačítkem nahoře.'
                      : 'Nic neodpovídá filtru.'}
                  </td>
                </tr>
              )}
              {visible.map((item) => (
                <tr key={item.id} className="border-t border-line hover:bg-[#FAF8FF]">
                  <td className="px-3 py-3.5 font-heading font-semibold text-sm text-ink">{item.name}</td>
                  <td className="px-3 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                    {item.ic ?? '—'}
                  </td>
                  <td className="px-3 py-3.5 text-sm font-heading text-muted">
                    {item.email ?? '—'}
                    {item.phone && <span className="block text-xs font-body text-muted/80">{item.phone}</span>}
                  </td>
                  <td className="px-3 py-3.5 text-sm font-heading text-muted">{item.city ?? '—'}</td>
                  <td className="px-3 py-3.5 text-sm font-heading">
                    {item.existing ? (
                      <span className="inline-flex flex-col">
                        <span className="text-ink">{item.existing.label}</span>
                        <span className="text-xs font-body text-muted/80">{item.existing.where}</span>
                      </span>
                    ) : (
                      <span className="text-muted/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <select
                      value={item.kind}
                      disabled={busyId === item.id}
                      onChange={(e) => setKind(item.id, e.target.value as CaflouContactKind)}
                      className={`rounded-pill border-0 px-3 py-1.5 text-xs font-heading font-semibold outline-none disabled:opacity-50 ${CONTACT_KIND_CLASSES[item.kind]}`}
                    >
                      {CONTACT_KIND_OPTIONS.map((kind) => (
                        <option key={kind} value={kind}>
                          {CONTACT_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
