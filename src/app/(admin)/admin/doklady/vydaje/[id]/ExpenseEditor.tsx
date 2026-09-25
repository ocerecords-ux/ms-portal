'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Currency, PaymentMethod } from '@prisma/client';
import { formatMoney, minorToInput, parseMoneyToMinor } from '@/lib/doklady';
import { nazevZpusobuUhrady, ZPUSOBY_UHRADY } from '@/lib/uctenka';
import { CURRENCIES, CURRENCY_NAMES } from '@/lib/doklady';
import { PrilohyVydaje, type DalsiPriloha } from './PrilohyVydaje';
import { UhradyVydaje, type UhradaRadek } from './UhradyVydaje';
import { EXPENSE_VAT_RATES, expenseTotalMinor, stavUhrady, uhrazenoMinor, zbyvaMinor } from '@/lib/expenses';
import { formatRate, toCzkMinor } from '@/lib/cnb';
import { ProjectSelect, type ProjectChoice } from '../../ProjectSelect';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

type Expense = {
  id: string;
  number: string;
  supplierCompanyId: string;
  supplierName: string;
  supplierLabel: string;
  categoryId: string;
  issuerName: string | null;
  currency: Currency;
  exchangeRate: number;
  exchangeRateDate: string | null;
  description: string;
  amountExVatMinor: number;
  vatRate: number;
  issueDate: string;
  dueDate: string;
  paid: boolean;
  paidAt: string | null;
  paymentMethod: PaymentMethod;
  attachmentUrl: string | null;
  attachmentName: string | null;
  note: string;
  caflouProjectId: string;
  projectName: string | null;
  // Doklad ze schranky (zadani 12. 9. 2026) - nez ho ucetni zaradi, visi
  // v zalozce Nezarazene a nepocita se do souctu.
  stav: 'NEZARAZENY' | 'ZARAZENY';
  mailOd: string | null;
  mailPredmet: string | null;
  mailPrijatoAt: string | null;
  navrhJson: string | null;
};

/** Co model z prilohy vycetl - zajima nas jistota a pripadna chyba. */
type Navrh = { jistota?: number | null; chyba?: string | null };

function prectiNavrh(json: string | null): Navrh | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as Navrh;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Pás nad dokladem, který přišel e-mailem.
 *
 * Účetní musí na první pohled vidět dvě věci: odkud doklad je (aby poznala
 * fakturu herce od faktury za nájem ještě před otevřením přílohy) a nakolik
 * se dá věřit vyplněným číslům. Vyčtené údaje jsou návrh, ne pravda —
 * u naskenované faktury se model může seknout v číslici a v účetnictví by to
 * nadělalo víc škody než ruční přepsání.
 */
function PasZeSchranky({ expense }: { expense: Expense }) {
  const navrh = prectiNavrh(expense.navrhJson);
  const jistota = typeof navrh?.jistota === 'number' ? Math.round(navrh.jistota * 100) : null;

  const stavCteni = navrh?.chyba
    ? `Údaje se nepodařilo vyčíst (${navrh.chyba}) — vyplňte je prosím ručně.`
    : navrh
      ? `Údaje vyčetl portál z přílohy${jistota !== null ? ` (jistota ${jistota} %)` : ''} — překontrolujte je.`
      : 'Údaje se z přílohy ještě nečetly. Zkuste za chvíli obnovit stránku.';

  return (
    <div className="bg-tint border border-brand-purple/40 rounded-card px-5 py-4 flex flex-col gap-1">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-brand-purpleDark">
        Doklad z e-mailu · čeká na zařazení
      </span>
      {expense.mailOd && (
        <span className="text-sm font-body text-ink">
          Od: <span className="font-heading">{expense.mailOd}</span>
        </span>
      )}
      {expense.mailPredmet && (
        <span className="text-sm font-body text-muted">Předmět: {expense.mailPredmet}</span>
      )}
      {expense.mailPrijatoAt && (
        <span className="text-xs font-body text-muted">Přišlo {formatDateTime(expense.mailPrijatoAt)}</span>
      )}
      <span className={`text-xs font-body mt-1 ${navrh?.chyba ? 'text-danger' : 'text-muted'}`}>{stavCteni}</span>
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Detail přijatého dokladu - úprava, přepnutí úhrady a příloha. */
export function ExpenseEditor({
  expense,
  categories,
  companies,
  projects,
  dalsiPrilohy,
  uhrady,
}: {
  expense: Expense;
  categories: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  projects: ProjectChoice[];
  dalsiPrilohy: DalsiPriloha[];
  /** Jednotlivé úhrady, když se doklad platí na vícekrát (25. 9. 2026). */
  uhrady: UhradaRadek[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    number: expense.number,
    supplierCompanyId: expense.supplierCompanyId,
    supplierName: expense.supplierName,
    categoryId: expense.categoryId,
    caflouProjectId: expense.caflouProjectId,
    description: expense.description,
    amount: minorToInput(expense.amountExVatMinor),
    vatRate: expense.vatRate,
    dueDate: expense.dueDate,
    note: expense.note,
    // Zpetne upravy (21. 9. 2026) - i datum, mena a zpusob uhrady.
    issueDate: expense.issueDate,
    currency: expense.currency,
    paymentMethod: expense.paymentMethod,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nezarazeny = expense.stav === 'NEZARAZENY';

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  const amountMinor = parseMoneyToMinor(form.amount);
  const total = expenseTotalMinor(amountMinor, form.vatRate);

  /**
   * Stav úhrady se počítá z ULOŽENÝCH čísel, ne z rozepsaného formuláře -
   * jinak by „zbývá" skákalo při každém ťuknutí do částky.
   */
  const celkemUlozene = expenseTotalMinor(expense.amountExVatMinor, expense.vatRate);
  const jizUhrazeno = uhrazenoMinor(uhrady, celkemUlozene, expense.paid);
  const zbyva = zbyvaMinor(celkemUlozene, jizUhrazeno);
  const stavPlatby = stavUhrady(celkemUlozene, jizUhrazeno);
  // Jakmile je zapsaná první úhrada, platí součet úhrad - přepínač
  // uhrazeno/neuhrazeno by proti němu jen lhal.
  const podleUhrad = uhrady.length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: form.number,
          supplierCompanyId: form.supplierCompanyId || null,
          supplierName: form.supplierName,
          categoryId: form.categoryId || null,
          caflouProjectId: form.caflouProjectId || null,
          description: form.description,
          amountExVatMinor: amountMinor,
          vatRate: form.vatRate,
          dueDate: form.dueDate || null,
          note: form.note,
          issueDate: form.issueDate,
          paymentMethod: form.paymentMethod,
          ...(form.currency !== expense.currency ? { currency: form.currency } : {}),
        }),
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

  /**
   * Zařazení dokladu ze schránky mezi výdaje (zadání 12. 9. 2026).
   *
   * Uloží se to, co je zrovna ve formuláři, a teprve pak se doklad přepne -
   * jinak by se mezi výdaji objevil s nepřekontrolovanými čísly. Kategorii
   * chceme mít vyplněnou: zařadit doklad bez ní znamená mít ho pak
   * v přehledech všude a nikde.
   */
  async function zarad() {
    if (!form.categoryId) {
      setError('Vyberte kategorii — podle ní se doklad zařadí do přehledů.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: form.number,
          supplierCompanyId: form.supplierCompanyId || null,
          supplierName: form.supplierName,
          categoryId: form.categoryId,
          caflouProjectId: form.caflouProjectId || null,
          description: form.description,
          amountExVatMinor: amountMinor,
          vatRate: form.vatRate,
          dueDate: form.dueDate || null,
          note: form.note,
          issueDate: form.issueDate,
          paymentMethod: form.paymentMethod,
          ...(form.currency !== expense.currency ? { currency: form.currency } : {}),
          stav: 'ZARAZENY',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Zařazení se nezdařilo.');
        return;
      }
      router.push('/admin/doklady/vydaje?tab=nezarazene');
      router.refresh();
    } catch {
      setError('Zařazení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: !expense.paid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/expenses/${expense.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Smazání se nezdařilo.');
        return;
      }
      router.push('/admin/doklady/vydaje');
      router.refresh();
    } catch {
      setError('Smazání se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="flex flex-col gap-5">
      {nezarazeny && <PasZeSchranky expense={expense} />}
      <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display text-2xl text-ink">{expense.supplierLabel}</span>
          <span
            className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
              expense.paid
                ? 'bg-okTint text-status-done'
                : stavPlatby === 'CAST'
                  ? 'bg-warnTint text-status-progress'
                  : 'bg-tint text-brand-purpleDark'
            }`}
          >
            {nezarazeny
              ? 'Nezařazeno'
              : expense.paid
                ? 'Uhrazeno'
                : stavPlatby === 'CAST'
                  ? `Zbývá ${formatMoney(zbyva, expense.currency)}`
                  : 'Neuhrazeno'}
          </span>
          {/* Cim se platilo (zadani 10. 9. 2026) - u uctenky z benzinky je to
              to hlavni, proc uz je oznacena jako uhrazena. */}
          <span className="text-xs font-body text-muted">{nazevZpusobuUhrady(expense.paymentMethod)}</span>
          {expense.paidAt && (
            <span className="text-xs font-body text-muted">{formatDateTime(expense.paidAt)}</span>
          )}
          {expense.issuerName && (
            <span className="text-xs font-body text-muted">za {expense.issuerName}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {nezarazeny && (
            <button
              type="button"
              onClick={zarad}
              disabled={saving}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              Zařadit mezi výdaje
            </button>
          )}
          {/* Doklad placený na vícekrát se přepíná zápisem úhrad dole, ne tímhle
              tlačítkem (25. 9. 2026). */}
          {!podleUhrad && (
            <button
              type="button"
              onClick={togglePaid}
              disabled={saving}
              className={`font-heading font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-60 ${
                expense.paid
                  ? 'border border-line text-ink hover:bg-field'
                  : 'bg-brand-green text-onAccent hover:brightness-95'
              }`}
            >
              {expense.paid ? 'Zrušit úhradu' : 'Označit jako uhrazený'}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{error}</p>}
      {saved && <p className="text-sm text-ink bg-tint border border-line rounded-lg px-4 py-3 m-0">Uloženo.</p>}

      <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Dodavatel z Firem</span>
            <VyberPole
              value={form.supplierCompanyId}
              onChange={(e) => set('supplierCompanyId', e.target.value)}
              className={inputClass}
            >
              <option value="">— není ve Firmách —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </VyberPole>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Nebo jméno dodavatele</span>
            <input
              value={form.supplierName}
              onChange={(e) => set('supplierName', e.target.value)}
              placeholder="u drobného dokladu"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Číslo dokladu</span>
            <input value={form.number} onChange={(e) => set('number', e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Kategorie</span>
            <VyberPole value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
              <option value="">— bez kategorie —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </VyberPole>
          </label>
        </div>

        {/* Projekt (zadani 8. 9. 2026) - doklad je pak videt v detailu projektu. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Projekt</span>
          <ProjectSelect
            value={form.caflouProjectId}
            onChange={(id) => set('caflouProjectId', id)}
            projects={projects}
            currentName={expense.projectName}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Název</span>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Částka bez DPH</span>
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              className={`${inputClass} text-right tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">DPH</span>
            <VyberPole value={form.vatRate} onChange={(e) => set('vatRate', Number(e.target.value))} className={inputClass}>
              {EXPENSE_VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? 'bez DPH' : `${r} %`}
                </option>
              ))}
            </VyberPole>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Splatnost</span>
            <DatumPole value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Datum dokladu</span>
            <DatumPole value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Měna</span>
            <VyberPole value={form.currency} onChange={(e) => set('currency', e.target.value as Currency)} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_NAMES[c]}
                </option>
              ))}
            </VyberPole>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Hrazeno</span>
            <VyberPole
              value={form.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}
              className={inputClass}
            >
              {ZPUSOBY_UHRADY.map((z) => (
                <option key={z.hodnota} value={z.hodnota}>
                  {z.nazev}
                </option>
              ))}
            </VyberPole>
          </label>
        </div>

        <div className="border-t border-line pt-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm font-heading text-muted">
            {expense.currency !== 'CZK' && expense.exchangeRateDate && (
              <span className="block text-xs font-body">
                Kurz ČNB: 1 {expense.currency} = {formatRate(expense.exchangeRate)} Kč ke dni{' '}
                {new Intl.DateTimeFormat('cs-CZ').format(new Date(expense.exchangeRateDate))}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Celkem</p>
            <p className="font-display text-2xl text-ink m-0 tabular-nums">{formatMoney(total, form.currency)}</p>
            {expense.currency !== 'CZK' && (
              <p className="text-xs font-body text-muted m-0 tabular-nums">
                {formatMoney(toCzkMinor(total, expense.exchangeRate), 'CZK')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Úhrady na vícekrát (25. 9. 2026). U nezařazeného dokladu ze schránky
          nemá smysl platit dřív, než ho účetní překontroluje a zařadí. */}
      {!nezarazeny && (
        <UhradyVydaje
          expenseId={expense.id}
          mena={expense.currency}
          celkemMinor={celkemUlozene}
          uhrady={uhrady}
          paid={expense.paid}
          vychoziZpusob={expense.paymentMethod}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Poznámka</span>
          <textarea
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            rows={3}
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
          />
        </div>

        <PrilohyVydaje
          expenseId={expense.id}
          hlavni={expense.attachmentUrl ? { nazev: expense.attachmentName } : null}
          dalsi={dalsiPrilohy}
        />
      </div>

      <div>
        <TlacitkoSmazat
          onSmazat={remove}
          disabled={saving}
          popisek="Smazat doklad"
          otazka="Opravdu smazat doklad?"
        />
      </div>
    </div>
  );
}
