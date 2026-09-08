'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Currency } from '@prisma/client';
import { CURRENCIES, CURRENCY_NAMES } from '@/lib/doklady';
import { EXPENSE_VAT_RATES } from '@/lib/expenses';

/**
 * Zadání přijatého dokladu. Schválně jedna obrazovka bez překlikávání —
 * doklady se zadávají po dávkách, takže je důležité, aby to šlo rychle.
 * Částka se zadává BEZ DPH, sazba se u každého dokladu nastaví zvlášť
 * (herci nejsou vždy plátci) a 0 % znamená bez DPH.
 */
export function NewExpenseForm({
  categories,
  companies,
  issuers,
}: {
  categories: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  issuers: { id: string; name: string; isDefault: boolean; currency: Currency }[];
}) {
  const router = useRouter();
  const defaultIssuer = issuers.find((i) => i.isDefault) ?? issuers[0];
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [supplierMode, setSupplierMode] = useState<'firma' | 'jmeno'>('firma');
  const [form, setForm] = useState({
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    supplierCompanyId: '',
    supplierName: '',
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
      if (supplierMode === 'firma') {
        body.set('supplierCompanyId', form.supplierCompanyId);
      } else {
        body.set('supplierName', form.supplierName);
      }
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
      // Formular necháme otevřený a jen vyprázdníme - doklady se zadávají po dávkách.
      setForm((f) => ({ ...f, number: '', description: '', amount: '', note: '', dueDate: '' }));
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch {
      setError('Doklad se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

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
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Kategorie</span>
          <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
            <option value="">— bez kategorie —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Dodavatel - buď z Firem, nebo jen jménem u drobného dokladu */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSupplierMode('firma')}
            className={`px-3 py-1.5 text-xs font-heading font-semibold rounded-pill transition-colors ${
              supplierMode === 'firma' ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
            }`}
          >
            Dodavatel z Firem
          </button>
          <button
            type="button"
            onClick={() => setSupplierMode('jmeno')}
            className={`px-3 py-1.5 text-xs font-heading font-semibold rounded-pill transition-colors ${
              supplierMode === 'jmeno' ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
            }`}
          >
            Drobný doklad
          </button>
        </div>
        {supplierMode === 'firma' ? (
          <select
            required
            value={form.supplierCompanyId}
            onChange={(e) => set('supplierCompanyId', e.target.value)}
            className={inputClass}
          >
            <option value="">— vyberte dodavatele —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            value={form.supplierName}
            onChange={(e) => set('supplierName', e.target.value)}
            placeholder="např. Benzina, Shell — kdo doklad vystavil"
            className={inputClass}
          />
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Popis</span>
        <input
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="za co to bylo"
          className={inputClass}
        />
      </label>

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
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Naše firma</span>
          <select
            value={form.issuerCompanyId}
            onChange={(e) => set('issuerCompanyId', e.target.value)}
            className={inputClass}
          >
            <option value="">— nevybráno —</option>
            {issuers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
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
        <label className="flex items-center gap-2 text-sm font-heading text-ink pb-2">
          <input type="checkbox" checked={form.paid} onChange={(e) => set('paid', e.target.checked)} />
          Už uhrazeno
        </label>
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
        <span className="text-xs text-muted font-body">Formulář zůstane otevřený, ať jde zadat víc dokladů za sebou.</span>
      </div>
    </form>
  );
}
