'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RECORDING_STATUS_CLASSES, RECORDING_STATUS_LABELS, formatDateTime } from '@/lib/calendar';

type Nabidka = {
  id: string;
  actorName: string;
  studioName: string;
  requiredSessions: number;
  offeredCount: number;
  selectedCount: number;
  confirmedCount: number;
  status: string;
  createdAt: string;
};

/**
 * Natáčecí frekvence na projektové kartě (zadani 8. 9. 2026). Ukazuje, kolik
 * frekvencí je podle normostran potřeba, a nechá z projektu založit nabídku
 * termínů pro konkrétního herce.
 *
 * Kniha dělená mezi víc herců má víc nabídek — každou se svým počtem
 * normostran, proto se dá založit opakovaně.
 */
export function RecordingSection({
  caflouProjectId,
  projectName,
  companyId,
  pageCount,
  sessionsFromPages,
  narratorFromCaflou,
  herci,
  studios,
  defaultActorUserId,
  requests,
  canManage,
}: {
  caflouProjectId: string;
  projectName: string;
  companyId: string | null;
  pageCount: number | null;
  sessionsFromPages: number;
  narratorFromCaflou: string | null;
  herci: { id: string; label: string }[];
  studios: { id: string; name: string }[];
  defaultActorUserId: string | null;
  requests: Nabidka[];
  canManage: boolean;
}) {
  const router = useRouter();
  const dnes = new Date();
  const zaMesic = new Date();
  zaMesic.setMonth(zaMesic.getMonth() + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    actorUserId: defaultActorUserId ?? '',
    studioId: studios[0]?.id ?? '',
    requiredSessions: Math.max(1, sessionsFromPages),
    pageCount: pageCount ?? 0,
    periodFrom: dnes.toISOString().slice(0, 10),
    periodTo: zaMesic.toISOString().slice(0, 10),
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function zaloz(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/kalendar/nabidky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caflouProjectId,
          projectName,
          companyId: companyId || undefined,
          actorUserId: form.actorUserId,
          studioId: form.studioId,
          pageCount: form.pageCount || undefined,
          requiredSessions: form.requiredSessions,
          periodFrom: form.periodFrom,
          periodTo: form.periodTo,
          note: form.note || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Nabídku se nepodařilo založit.');
        return;
      }
      router.push(`/kalendar/nabidka/${data.id}`);
    } catch {
      setError('Nabídku se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Natáčecí frekvence
          </h2>
          <p className="text-sm font-body text-muted m-0 mt-1">
            {pageCount != null && pageCount > 0
              ? `${pageCount} normostran → ${sessionsFromPages} ${sessionsFromPages === 1 ? 'frekvence' : sessionsFromPages < 5 ? 'frekvence' : 'frekvencí'}`
              : 'Normostrany z Caflou nedorazily — počet frekvencí zadejte ručně.'}
            {narratorFromCaflou ? ` · herec podle Caflou: ${narratorFromCaflou}` : ''}
          </p>
        </div>
        {canManage && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors"
          >
            Vytvořit nabídku termínů
          </button>
        )}
      </div>

      {requests.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line border-t border-line pt-1">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <Link
                  href={`/kalendar/nabidka/${r.id}`}
                  className="block text-sm font-heading font-semibold text-ink hover:text-brand-purple no-underline"
                >
                  {r.actorName}
                </Link>
                <span className="block text-xs font-body text-muted">
                  {r.studioName} · {formatDateTime(r.createdAt)}
                </span>
              </span>
              <span className="flex items-center gap-4 shrink-0">
                <span className="text-xs font-body text-muted tabular-nums">
                  {r.confirmedCount > 0
                    ? `${r.confirmedCount} potvrzeno`
                    : r.selectedCount > 0
                      ? `vybráno ${r.selectedCount} z ${r.requiredSessions}`
                      : `nabídnuto ${r.offeredCount} · potřeba ${r.requiredSessions}`}
                </span>
                <span
                  className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                    RECORDING_STATUS_CLASSES[r.status] ?? 'bg-field text-muted'
                  }`}
                >
                  {RECORDING_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {requests.length === 0 && !open && (
        <p className="text-sm font-body text-muted m-0">
          K projektu zatím žádná nabídka termínů není.
        </p>
      )}

      {open && (
        <form onSubmit={zaloz} className="flex flex-col gap-4 border-t border-line pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Herec</span>
              <select
                required
                value={form.actorUserId}
                onChange={(e) => set('actorUserId', e.target.value)}
                className={inputClass}
              >
                <option value="">— vyberte herce —</option>
                {herci.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
              <span className="text-xs font-body text-muted">
                Volba se u projektu zapamatuje — v Caflou je herec jen text.
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Studio</span>
              <select value={form.studioId} onChange={(e) => set('studioId', e.target.value)} className={inputClass}>
                {studios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Normostrany pro tohoto herce</span>
              <input
                type="number"
                min={0}
                value={form.pageCount}
                onChange={(e) => {
                  const ns = Number(e.target.value) || 0;
                  setForm((f) => ({ ...f, pageCount: ns }));
                }}
                className={`${inputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Počet frekvencí</span>
              <input
                type="number"
                min={1}
                required
                value={form.requiredSessions}
                onChange={(e) => set('requiredSessions', Number(e.target.value) || 1)}
                className={`${inputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Období od</span>
              <input
                type="date"
                required
                value={form.periodFrom}
                onChange={(e) => set('periodFrom', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Období do</span>
              <input
                type="date"
                required
                value={form.periodTo}
                onChange={(e) => set('periodTo', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Poznámka pro herce</span>
            <input value={form.note} onChange={(e) => set('note', e.target.value)} className={inputClass} />
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {busy ? 'Zakládám…' : 'Založit a vybrat termíny'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
              Zavřít
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
