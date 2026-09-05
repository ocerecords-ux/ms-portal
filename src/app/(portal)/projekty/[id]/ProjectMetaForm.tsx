'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIORITY_LABELS, PRIORITY_OPTIONS, PROJECT_TYPES, projectTypeLabel } from '@/lib/projectTypes';

type Initial = {
  driveUrl: string;
  managerUserId: string;
  priority: string;
  projectType: string;
};

/**
 * Interni atributy projektu (zadani 5. 9. 2026) - odkaz na KZ, manazer
 * projektu, priorita, typ projektu. Pri canEdit=false (zvukar) se stejna
 * data jen vypisou ke cteni; skutecnou kontrolu prav dela server (viz
 * /api/projects/[id]/meta).
 */
export function ProjectMetaForm({
  caflouProjectId,
  canEdit,
  managers,
  companyDriveFolderUrl,
  initial,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  managers: { id: string; label: string }[];
  companyDriveFolderUrl: string | null;
  initial: Initial;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const managerLabel = managers.find((m) => m.id === values.managerUserId)?.label ?? '—';

  if (!canEdit) {
    return (
      <div className="bg-white rounded-card border border-line shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Interní údaje
          </h2>
          <span className="text-xs font-heading text-muted bg-field border border-line rounded-pill px-3 py-1">
            Jen ke čtení
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 m-0">
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Odkaz na KZ</dt>
            <dd className="text-sm font-heading m-0 mt-1">
              {values.driveUrl ? (
                <a href={values.driveUrl} target="_blank" rel="noreferrer" className="text-brand-purple break-all">
                  Otevřít složku ↗
                </a>
              ) : (
                <span className="text-ink">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Manažer projektu</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">{managerLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Priorita</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {values.priority ? PRIORITY_LABELS[values.priority as keyof typeof PRIORITY_LABELS] : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Typ projektu</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">{projectTypeLabel(values.projectType) ?? '—'}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Interní údaje</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-body text-ink">Odkaz na KZ</span>
          <input
            type="url"
            placeholder="https://drive.google.com/..."
            value={values.driveUrl}
            onChange={(e) => set('driveUrl', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          />
          <span className="text-xs text-muted font-body">
            Složka projektu na Google Disku.
            {companyDriveFolderUrl && (
              <>
                {' '}
                <a href={companyDriveFolderUrl} target="_blank" rel="noreferrer" className="text-brand-purple">
                  Otevřít složku firmy ↗
                </a>
              </>
            )}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Manažer projektu</span>
          <select
            value={values.managerUserId}
            onChange={(e) => set('managerUserId', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Priorita</span>
          <select
            value={values.priority}
            onChange={(e) => set('priority', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-body text-ink">Typ projektu</span>
          <select
            value={values.projectType}
            onChange={(e) => set('projectType', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        {saved && <span className="text-sm font-heading text-brand-greenDeep">Uloženo.</span>}
      </div>
    </form>
  );
}
