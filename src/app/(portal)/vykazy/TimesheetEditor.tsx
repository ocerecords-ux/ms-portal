'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkType } from '@prisma/client';
import {
  WORK_TYPE_LABELS,
  WORK_TYPE_OPTIONS,
  durationMinutes,
  entryAmount,
  formatCzk,
  formatDuration,
  formatTime,
  parseTime,
} from '@/lib/timesheets';

type Entry = {
  id: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  workType: WorkType;
  projectName: string;
  note: string | null;
  hourlyRateSnapshot: number;
  userId: string;
  userLabel: string;
  mine: boolean;
};

type ProjectOption = { id: string; label: string };

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('cs-CZ').format(d);
}

/** Výkazy práce zvukaře - zápis i přehled. */
export function TimesheetEditor({
  isAdmin,
  hourlyRate,
  projectOptions,
  entries,
}: {
  isAdmin: boolean;
  hourlyRate: number;
  projectOptions: ProjectOption[];
  entries: Entry[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    date: todayIso(),
    from: '09:00',
    to: '13:00',
    workType: 'RECORDING' as WorkType,
    project: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Živý náhled: kolik hodin to je a kolik to dělá peněz.
  const preview = useMemo(() => {
    const start = parseTime(form.from);
    const end = parseTime(form.to);
    if (start === null || end === null || start === end) return null;
    const minutes = durationMinutes(start, end);
    return { minutes, amount: entryAmount(start, end, hourlyRate) };
  }, [form.from, form.to, hourlyRate]);

  const totals = useMemo(() => {
    let minutes = 0;
    let amount = 0;
    for (const e of entries) {
      minutes += durationMinutes(e.startMinutes, e.endMinutes);
      amount += entryAmount(e.startMinutes, e.endMinutes, e.hourlyRateSnapshot);
    }
    return { minutes, amount };
  }, [entries]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const selected = projectOptions.find((p) => p.id === form.project);
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          from: form.from,
          to: form.to,
          workType: form.workType,
          caflouProjectId: selected?.id ?? '',
          projectName: selected?.label ?? form.project,
          note: form.note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setForm((f) => ({ ...f, note: '' }));
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/timesheets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Smazání se nezdařilo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Smazání se nezdařilo.');
    } finally {
      setBusyId(null);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Výkazy</h1>
          <p className="text-muted text-sm mt-1 font-body">
            {isAdmin
              ? 'Odpracované hodiny celého týmu. Částka se počítá z hodinové sazby platné v době zápisu.'
              : `Zapište si odpracovaný čas. Vaše hodinová sazba je ${formatCzk(hourlyRate)}.`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Celkem</p>
          <p className="font-display text-2xl text-ink m-0 tabular-nums">{formatCzk(totals.amount)}</p>
          <p className="text-xs font-body text-muted m-0">{formatDuration(totals.minutes)}</p>
        </div>
      </div>

      <form onSubmit={addEntry} className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nový výkaz</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Datum</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Od</span>
            <input
              type="time"
              required
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Do</span>
            <input
              type="time"
              required
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Druh práce</span>
            <select
              value={form.workType}
              onChange={(e) => setForm({ ...form, workType: e.target.value as WorkType })}
              className={inputClass}
            >
              {WORK_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {WORK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Projekt</span>
            <select
              required
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className={inputClass}
            >
              <option value="">— vyberte projekt —</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {projectOptions.length === 0 && (
              <span className="text-xs text-muted font-body">
                Zatím se nenačetly žádné rozpracované projekty z Caflou.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Poznámka</span>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="nepovinné"
              className={inputClass}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            {saving ? 'Ukládám…' : 'Přidat výkaz'}
          </button>
          {preview ? (
            <span className="text-sm font-heading text-ink">
              {formatDuration(preview.minutes)} ·{' '}
              <strong className="text-brand-purpleDark">{formatCzk(preview.amount)}</strong>
            </span>
          ) : (
            <span className="text-sm font-body text-muted">Zadejte platný čas od–do.</span>
          )}
        </div>
      </form>

      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse">
            <thead>
              <tr className="bg-brand-purple text-white font-heading text-xs">
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum</th>
                {isAdmin && <th className="text-left px-4 py-3.5 whitespace-nowrap">Zvukař</th>}
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Od–do</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Hodiny</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">Druh práce</th>
                <th className="text-left px-4 py-3.5">Projekt</th>
                <th className="text-right px-4 py-3.5 whitespace-nowrap">Částka</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-muted text-sm font-body">
                    Zatím tu není žádný výkaz.
                  </td>
                </tr>
              )}
              {entries.map((e) => {
                const minutes = durationMinutes(e.startMinutes, e.endMinutes);
                return (
                  <tr key={e.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 text-sm font-heading text-ink tabular-nums whitespace-nowrap">
                      {formatDate(e.date)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-sm font-heading text-muted whitespace-nowrap">{e.userLabel}</td>
                    )}
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                      {formatTime(e.startMinutes)}–{formatTime(e.endMinutes)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                      {formatDuration(minutes)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                          e.workType === 'RECORDING'
                            ? 'bg-[#F1ECFF] text-brand-purpleDark'
                            : 'bg-[#E3F9EC] text-status-done'
                        }`}
                      >
                        {WORK_TYPE_LABELS[e.workType]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-muted">
                      {e.projectName}
                      {e.note && <span className="block text-xs text-muted/80 font-body">{e.note}</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading text-ink tabular-nums text-right whitespace-nowrap">
                      {formatCzk(entryAmount(e.startMinutes, e.endMinutes, e.hourlyRateSnapshot))}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {(e.mine || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => removeEntry(e.id)}
                          disabled={busyId === e.id}
                          className="text-red-600 text-sm font-heading disabled:opacity-50"
                        >
                          Smazat
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
