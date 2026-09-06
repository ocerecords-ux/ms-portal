'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeBudget, type BudgetSettingsValues } from '@/lib/budget';

/**
 * Parametry, ze kterych se pocita rozpocet audioknihy (zadani 6. 9. 2026).
 * Vedle formulare bezi zivy priklad, at je hned videt, co ktera zmena udela.
 */
export function BudgetSettingsForm({ initial }: { initial: BudgetSettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const example = useMemo(() => computeBudget(260, values), [values]);

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

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';
  const czk = (v: number) => `${v.toLocaleString('cs-CZ')} Kč`;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Parametry rozpočtu audioknihy
        </h2>
        <p className="text-muted text-xs font-body mt-1 m-0">
          Z těchto čísel se u projektů počítá rozpočet — natáčecí frekvence, střih a bonus.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Normostran na frekvenci</span>
          <input inputMode="numeric" value={values.pagesPerSession} onChange={(e) => set('pagesPerSession', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Délka frekvence (hodiny)</span>
          <input inputMode="numeric" value={values.sessionHours} onChange={(e) => set('sessionHours', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Hodinová sazba pro rozpočet (Kč)</span>
          <input inputMode="numeric" value={values.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Střih (% z počtu frekvencí)</span>
          <input inputMode="numeric" value={values.editingCoefficient} onChange={(e) => set('editingCoefficient', e.target.value)} className={inputClass} />
          <span className="text-xs text-muted font-body">120 = o 20 % víc než natáčení</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Bonus za normostranu (Kč)</span>
          <input inputMode="numeric" value={values.bonusPerPage} onChange={(e) => set('bonusPerPage', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="bg-field border border-line rounded-lg p-4">
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0 mb-2">Příklad — audiokniha 260 NS</p>
        <table className="text-sm font-heading text-ink">
          <tbody>
            <tr>
              <td className="pr-6 py-0.5">Natáčení</td>
              <td className="pr-6 py-0.5 text-muted tabular-nums">{example.sessions} × {czk(example.unitPrice)}</td>
              <td className="py-0.5 tabular-nums text-right">{czk(example.recordingCost)}</td>
            </tr>
            <tr>
              <td className="pr-6 py-0.5">Střih</td>
              <td className="pr-6 py-0.5 text-muted tabular-nums">{example.editingUnits} × {czk(example.unitPrice)}</td>
              <td className="py-0.5 tabular-nums text-right">{czk(example.editingCost)}</td>
            </tr>
            <tr>
              <td className="pr-6 py-0.5">Bonus</td>
              <td className="pr-6 py-0.5 text-muted tabular-nums">260 × {czk(values.bonusPerPage)}</td>
              <td className="py-0.5 tabular-nums text-right">{czk(example.bonus)}</td>
            </tr>
            <tr className="border-t border-line">
              <td className="pr-6 pt-1.5 font-semibold">Náklady celkem</td>
              <td></td>
              <td className="pt-1.5 tabular-nums text-right font-semibold">{czk(example.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit parametry'}
        </button>
        {saved && <span className="text-sm font-heading text-brand-greenDeep">Uloženo.</span>}
      </div>
    </form>
  );
}
