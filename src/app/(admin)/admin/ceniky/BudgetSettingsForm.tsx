'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeBudget, type BudgetSettingsValues } from '@/lib/budget';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { kodJazyka } from '@/lib/jazyk';

/** Kolik normostran má ukázková audiokniha vedle formuláře. */
const PRIKLAD_NS = 260;

/**
 * Parametry, ze kterych se pocita rozpocet audioknihy (zadani 6. 9. 2026).
 * Vedle formulare bezi zivy priklad, at je hned videt, co ktera zmena udela.
 */
export function BudgetSettingsForm({ initial }: { initial: BudgetSettingsValues }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const example = useMemo(() => computeBudget(PRIKLAD_NS, values), [values]);

  function set(key: keyof BudgetSettingsValues, raw: string) {
    const n = parseInt(raw, 10);
    setValues((v) => ({ ...v, [key]: Number.isFinite(n) ? n : 0 }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/budget-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('cenik.ulozeniSelhalo'));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t('cenik.ulozeniSelhalo'));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';
  // Cisla podle jazyka listy, mena zustava Kc - rozpocet se vede v korunach.
  const czk = (v: number) => `${v.toLocaleString(kodJazyka(jazyk))} Kč`;

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('cenik.parametryRozpoctu')}
        </h2>
        <p className="text-muted text-xs font-body mt-1 m-0">{t('cenik.parametryRozpoctuPopis')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('cenik.nsNaFrekvenci')}</span>
          <input inputMode="numeric" value={values.pagesPerSession} onChange={(e) => set('pagesPerSession', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('cenik.delkaFrekvence')}</span>
          <input inputMode="numeric" value={values.sessionHours} onChange={(e) => set('sessionHours', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('cenik.hodinovaSazba')}</span>
          <input inputMode="numeric" value={values.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('cenik.strihProcenta')}</span>
          <input inputMode="numeric" value={values.editingCoefficient} onChange={(e) => set('editingCoefficient', e.target.value)} className={inputClass} />
          <span className="text-xs text-muted font-body">{t('cenik.strihProcentaPopis')}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('cenik.bonusZaNs')}</span>
          <input inputMode="numeric" value={values.bonusPerPage} onChange={(e) => set('bonusPerPage', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="bg-field border border-line rounded-lg p-4">
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0 mb-2">
          {t('cenik.priklad', { pocet: PRIKLAD_NS })}
        </p>
        <table className="text-sm font-heading text-ink">
          <tbody>
            <tr>
              <td className="pr-6 py-0.5">{t('cenik.nataceni')}</td>
              <td className="pr-6 py-0.5 text-muted tabular-nums">{example.sessions} × {czk(example.unitPrice)}</td>
              <td className="py-0.5 tabular-nums text-right">{czk(example.recordingCost)}</td>
            </tr>
            <tr>
              <td className="pr-6 py-0.5">{t('cenik.strih')}</td>
              <td className="pr-6 py-0.5 text-muted tabular-nums">{example.editingUnits} × {czk(example.unitPrice)}</td>
              <td className="py-0.5 tabular-nums text-right">{czk(example.editingCost)}</td>
            </tr>
            <tr>
              <td className="pr-6 py-0.5">{t('cenik.bonus')}</td>
              <td className="pr-6 py-0.5 text-muted tabular-nums">
                {PRIKLAD_NS} × {czk(values.bonusPerPage)}
              </td>
              <td className="py-0.5 tabular-nums text-right">{czk(example.bonus)}</td>
            </tr>
            <tr className="border-t border-line">
              <td className="pr-6 pt-1.5 font-semibold">{t('cenik.nakladyCelkem')}</td>
              <td></td>
              <td className="pt-1.5 tabular-nums text-right font-semibold">{czk(example.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? t('obecne.ukladam') : t('cenik.ulozitParametry')}
        </button>
        {saved && <span className="text-sm font-heading text-brand-greenDeep">{t('cenik.ulozeno')}</span>}
      </div>
    </form>
  );
}
