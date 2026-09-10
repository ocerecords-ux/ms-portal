'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CaflouContactKind } from '@prisma/client';
import {
  CONTACT_KIND_CLASSES,
  CONTACT_KIND_LABELS,
  CONTACT_KIND_OPTIONS,
} from '@/lib/caflouCompanies';
import { useRazeni, ThRadit } from '@/app/(portal)/components/RaditelnaTabulka';

export type CaflouCompanyRow = {
  id: string;
  name: string;
  ic: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  kind: CaflouContactKind;
  /** Podle ceho se to roztridilo (odhad pri nacteni), null u rucni volby. */
  kindReason: string | null;
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
  const [transferring, setTransferring] = useState(false);
  const [report, setReport] = useState<{ nazev: string; akce: string; detail: string }[] | null>(null);

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

  // Razeni kliknutim na nazev sloupce (zadani 9. 9. 2026). Pravidla jsou
  // spolecna s ostatnimi tabulkami - viz components/RaditelnaTabulka.
  const { razeni, prepni, serad } = useRazeni<(typeof items)[number]>({ key: 'nazev' });
  const serazene = serad(visible, {
    nazev: (i) => i.name,
    ic: (i) => i.ic ?? null,
    kontakt: (i) => i.email ?? i.phone ?? null,
    mesto: (i) => i.city ?? null,
    // Firmy, ktere v portalu jeste nejsou, jdou napred - to je to, co se resi.
    vPortalu: (i) => (i.existing ? 1 : 0),
    kdoToJe: (i) => i.kind,
  });

  /**
   * Natahne vsechno najednou (zadani 8. 9. 2026): nacte firmy z Caflou,
   * rovnou odhadne, kdo je klient a kdo herec, a co je rozhodnuto, prenese
   * do portalu. Co odhad nerozhodne, zustane tady k rucnimu projiti.
   */
  async function runImport(prenest = false) {
    setImporting(true);
    setError(null);
    setReport(null);
    setProgress('Načítám z Caflou…');
    try {
      // Typy jsou tu vypsane schvalne. Bez nich TypeScript hlasil "'res'
      // implicitly has type 'any' ... referenced directly or indirectly in its
      // own initializer" a build na Vercelu spadl: odpoved fetche se rozbaluje
      // pres `any` a zaroven z ni vychazi promenna `page`, kterou se ridi tahle
      // smycka - odvozeni typu se tim zacyklilo.
      let page: number | null = 1;
      let total = 0;
      // Pojistka proti nekonecne smycce, kdyby Caflou parametr page ignorovalo.
      for (let guard = 0; page !== null && guard < 60; guard += 1) {
        const res: Response = await fetch('/api/admin/caflou-firmy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page, autoKind: true }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || 'Import se nezdařil.');
          return;
        }
        total += Number(data?.ulozeno ?? 0);
        setProgress(`Načteno ${total} firem…`);
        page = typeof data?.dalsiStranka === 'number' ? data.dalsiStranka : null;
      }
      if (!prenest) {
        setProgress(`Hotovo — načteno ${total} firem.`);
        router.refresh();
        return;
      }
      setProgress(`Načteno ${total} firem, přenáším do portálu…`);
      const resPrenos: Response = await fetch('/api/admin/caflou-firmy/zalozit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vse: true }),
      });
      const data: any = await resPrenos.json().catch(() => ({}));
      if (!resPrenos.ok) {
        setError(data?.error || 'Přenos se nezdařil.');
        return;
      }
      setReport(Array.isArray(data?.vysledky) ? data.vysledky : []);
      setProgress(
        `Načteno ${total} firem · založeno ${data?.zalozeno ?? 0}, doplněno ${data?.doplneno ?? 0}, přeskočeno ${data?.preskoceno ?? 0}.`,
      );
      router.refresh();
    } catch {
      setError('Import se nezdařil.');
    } finally {
      setImporting(false);
    }
  }

  /**
   * Prenese roztridene radky do portalu - klienty do Firem, herce mezi
   * uzivatele. Uz zalozene zaznamy se nezakladaji znovu, jen se u nich
   * doplni prazdna pole (server to hlida znovu, viz /zalozit).
   */
  async function transferToPortal() {
    const ids = items.filter((i) => i.kind === 'KLIENT' || i.kind === 'HEREC').map((i) => i.id);
    if (ids.length === 0) {
      setError('Nejdřív u firem vyberte, jestli jde o klienta, nebo o herce.');
      return;
    }
    setTransferring(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/admin/caflou-firmy/zalozit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Přenos se nezdařil.');
        return;
      }
      setReport(Array.isArray(data?.vysledky) ? data.vysledky : []);
      setProgress(
        `Založeno ${data?.zalozeno ?? 0}, doplněno ${data?.doplneno ?? 0}, přeskočeno ${data?.preskoceno ?? 0}.`,
      );
      router.refresh();
    } catch {
      setError('Přenos se nezdařil.');
    } finally {
      setTransferring(false);
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
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 justify-end flex-wrap">
            <button
              type="button"
              onClick={() => runImport(false)}
              disabled={importing || transferring}
              className="font-heading font-semibold text-sm rounded-lg border border-line bg-surface px-4 py-2.5 text-brand-purple hover:border-brand-purple transition-colors disabled:opacity-60"
            >
              {importing ? 'Pracuji…' : 'Jen načíst'}
            </button>
            <button
              type="button"
              onClick={transferToPortal}
              disabled={transferring || importing || counts.KLIENT + counts.HEREC === 0}
              title="Přenese jen to, co je tady roztříděné"
              className="font-heading font-semibold text-sm rounded-lg border border-line bg-surface px-4 py-2.5 text-brand-purple hover:border-brand-purple transition-colors disabled:opacity-60"
            >
              {transferring ? 'Přenáším…' : `Přenést roztříděné (${counts.KLIENT + counts.HEREC})`}
            </button>
            <button
              type="button"
              onClick={() => runImport(true)}
              disabled={importing || transferring}
              title="Načte firmy z Caflou, odhadne klienty a herce a rovnou je založí v portálu"
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {importing || transferring ? 'Pracuji…' : 'Načíst a přenést do portálu'}
            </button>
          </div>
          {progress && <p className="text-xs font-body text-muted m-0 mt-1.5">{progress}</p>}
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>
      )}

      {report && report.length > 0 && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-4 max-h-64 overflow-y-auto">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0 mb-2">
            Co se stalo
          </h2>
          <ul className="m-0 pl-0 list-none flex flex-col gap-1.5">
            {report.map((r, index) => (
              <li key={`${r.nazev}-${index}`} className="text-sm font-body text-ink">
                <span
                  className={`inline-block min-w-[86px] text-xs font-heading font-semibold ${
                    r.akce === 'zalozeno'
                      ? 'text-status-done'
                      : r.akce === 'doplneno'
                        ? 'text-brand-purpleDark'
                        : 'text-status-progress'
                  }`}
                >
                  {r.akce === 'zalozeno' ? 'Založeno' : r.akce === 'doplneno' ? 'Doplněno' : 'Přeskočeno'}
                </span>
                {r.detail}
              </li>
            ))}
          </ul>
        </div>
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
                  active ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
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
            className="w-64 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
          />
        </div>
      </div>

      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-brand-purple text-white font-heading text-xs">
                <ThRadit label="Název" sloupec="nazev" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label="IČ" sloupec="ic" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label="Kontakt" sloupec="kontakt" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label="Město" sloupec="mesto" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label="Už v portálu" sloupec="vPortalu" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label="Kdo to je" sloupec="kdoToJe" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
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
              {serazene.map((item) => (
                <tr key={item.id} className="border-t border-line hover:bg-surfaceSoft">
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
                    {item.kindReason && (
                      <span className="block text-xs font-body text-muted/80 mt-1 max-w-[180px] whitespace-normal">
                        {item.kindReason}
                      </span>
                    )}
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
