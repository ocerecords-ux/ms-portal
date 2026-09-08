'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Currency } from '@prisma/client';
import { CURRENCIES, CURRENCY_NAMES, formatMoney, parseMoneyToMinor } from '@/lib/doklady';
import { EXPENSE_VAT_RATES, expenseTotalMinor } from '@/lib/expenses';

/**
 * Zadání přijatého dokladu. Schválně jedna obrazovka bez překlikávání —
 * doklady se zadávají po dávkách, takže je důležité, aby to šlo rychle.
 * Částka se zadává BEZ DPH, sazba se u každého dokladu nastaví zvlášť
 * (herci nejsou vždy plátci) a 0 % znamená bez DPH.
 */
export function NewExpenseForm({
  categories,
  issuers,
}: {
  categories: { id: string; name: string }[];
  issuers: { id: string; name: string; isDefault: boolean; currency: Currency }[];
}) {
  const router = useRouter();
  const defaultIssuer = issuers.find((i) => i.isDefault) ?? issuers[0];
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    number: '',
    categoryId: categories[0]?.id ?? '',
    issuerCompanyId: defaultIssuer?.id ?? '',
    currency: (defaultIssuer?.currency ?? 'CZK') as Currency,
    description: '',
    amount: '',
    vatRate: 21,
    paid: false,
    note: '',
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kategorie se daji zalozit primo tady (zadani 8. 9. 2026) - kdyz se zadava
  // doklad a kategorie jeste neexistuje, neni duvod kvuli tomu odchazet pryc.
  const [kategorie, setKategorie] = useState(categories);
  const [novaKategorie, setNovaKategorie] = useState<string | null>(null);
  const [kategorieBusy, setKategorieBusy] = useState(false);

  async function zalozitKategorii() {
    const name = (novaKategorie ?? '').trim();
    if (!name) return;
    setKategorieBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Kategorii se nepodařilo přidat.');
        return;
      }
      setKategorie((list) => [...list, { id: data.id, name: data.name }]);
      set('categoryId', data.id);
      setNovaKategorie(null);
      router.refresh();
    } catch {
      setError('Kategorii se nepodařilo přidat.');
    } finally {
      setKategorieBusy(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('issueDate', form.issueDate);
      if (form.dueDate) body.set('dueDate', form.dueDate);
      if (form.number) body.set('number', form.number);
      if (form.categoryId) body.set('categoryId', form.categoryId);
      if (form.issuerCompanyId) body.set('issuerCompanyId', form.issuerCompanyId);
      body.set('currency', form.currency);
      if (form.description) body.set('description', form.description);
      body.set('amount', form.amount);
      body.set('vatRate', String(form.vatRate));
      body.set('paid', form.paid ? 'true' : 'false');
      if (form.note) body.set('note', form.note);
      const file = fileRef.current?.files?.[0];
      if (file) body.set('attachment', file);

      const res = await fetch('/api/admin/expenses', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Doklad se nepodařilo uložit.');
        return;
      }
      // Po uložení zpátky na přehled (zadani 8. 9. 2026) - doklad je vidět
      // v seznamu a je jasné, že se opravdu uložil.
      setForm((f) => ({ ...f, number: '', description: '', amount: '', note: '', dueDate: '' }));
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
      setOpen(false);
      router.refresh();
    } catch {
      setError('Doklad se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  // Zivy prepocet na castku s DPH - jen kdyz uz je co pocitat.
  const bezDph = form.amount.trim() ? parseMoneyToMinor(form.amount) : null;
  const sDph = bezDph === null ? null : expenseTotalMinor(bezDph, form.vatRate);

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors"
      >
        + Nový výdaj
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nový výdaj</h2>

      {/* Nazev je prvni - zadava se jako prvni (zadani 8. 9. 2026). Dodavatel
          se u vydaje uz nevyplnuje vubec, je to zbytecny udaj. */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Název</span>
        <input
          required
          autoFocus
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="za co to bylo"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Datum dokladu</span>
          <input
            type="date"
            required
            value={form.issueDate}
            onChange={(e) => set('issueDate', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Splatnost</span>
          <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Číslo dokladu</span>
          <input value={form.number} onChange={(e) => set('number', e.target.value)} className={inputClass} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-body text-ink">Kategorie</span>
            <button
              type="button"
              onClick={() => setNovaKategorie(novaKategorie === null ? '' : null)}
              className="text-xs font-heading font-semibold text-brand-purple hover:text-brand-purpleDeep"
            >
              {novaKategorie === null ? '+ Nová kategorie' : 'Zrušit'}
            </button>
          </span>
          {novaKategorie === null ? (
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
              <option value="">— bez kategorie —</option>
              {kategorie.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex gap-2">
              <input
                autoFocus
                value={novaKategorie}
                onChange={(e) => setNovaKategorie(e.target.value)}
                onKeyDown={(e) => {
                  // Enter tady zaklada kategorii, ne odesila cely doklad.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void zalozitKategorii();
                  }
                  if (e.key === 'Escape') setNovaKategorie(null);
                }}
                placeholder="např. Marketing"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => void zalozitKategorii()}
                disabled={kategorieBusy || !novaKategorie.trim()}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60 shrink-0"
              >
                Přidat
              </button>
            </span>
          )}
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Částka bez DPH</span>
          <input
            required
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0,00"
            className={`${inputClass} text-right tabular-nums`}
          />
          {/* Kolik to dela s DPH je videt hned pri psani (zadani 8. 9. 2026) -
              na dokladu byva uvedena castka VCETNE, tak at se da zkontrolovat. */}
          <span className="text-xs font-body text-muted text-right tabular-nums">
            {sDph === null ? 's DPH —' : `s DPH ${formatMoney(sDph, form.currency)}`}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">DPH</span>
          <select value={form.vatRate} onChange={(e) => set('vatRate', Number(e.target.value))} className={inputClass}>
            {EXPENSE_VAT_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? 'bez DPH' : `${r} %`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Měna</span>
          <select
            value={form.currency}
            onChange={(e) => set('currency', e.target.value as Currency)}
            className={inputClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_NAMES[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <span className="text-sm font-body text-ink">Příloha (PDF nebo foto)</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="text-sm font-body text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-field file:px-3 file:py-2 file:text-sm file:font-heading file:text-ink"
          />
          {fileName && <span className="text-xs text-muted font-body truncate">{fileName}</span>}
        </label>
        {/* Prepinac se dvema stavy misto jednoho tlacitka (zadani 8. 9. 2026)
            - je z nej videt, ktera moznost plati, i bez najeti mysi. */}
        <span className="mb-0.5 inline-flex rounded-lg border border-line overflow-hidden">
          <button
            type="button"
            onClick={() => set('paid', false)}
            aria-pressed={!form.paid}
            className={`font-heading font-semibold text-sm px-4 py-2.5 transition-colors ${
              !form.paid ? 'bg-status-progress text-white' : 'bg-white text-muted hover:text-ink'
            }`}
          >
            Neuhrazeno
          </button>
          <button
            type="button"
            onClick={() => set('paid', true)}
            aria-pressed={form.paid}
            className={`font-heading font-semibold text-sm px-4 py-2.5 transition-colors border-l border-line ${
              form.paid ? 'bg-status-done text-white' : 'bg-white text-muted hover:text-ink'
            }`}
          >
            Uhrazeno
          </button>
        </span>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {busy ? 'Ukládám…' : 'Uložit doklad'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zavřít
        </button>
        <span className="text-xs text-muted font-body">Po uložení se vrátíte na přehled.</span>
      </div>
    </form>
  );
}
