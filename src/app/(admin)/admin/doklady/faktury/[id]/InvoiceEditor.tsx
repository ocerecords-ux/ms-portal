'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { Currency, InvoiceStatus } from '@prisma/client';
import {
  CURRENCIES,
  CURRENCY_NAMES,
  computeTotals,
  formatAddress,
  formatMoney,
  minorToInput,
  parseMoneyToMinor,
} from '@/lib/doklady';
import { formatRate, toCzkMinor } from '@/lib/cnb';
import { ProjectSelect, type ProjectChoice } from '../../ProjectSelect';
import { NahledDokladu } from '../../NahledDokladu';

type Item = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  vatRate: number;
};

type Party = {
  name: string;
  ic?: string | null;
  dic?: string | null;
  vatPayer?: boolean;
  contactEmail?: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
};

type Invoice = {
  id: string;
  number: string;
  variableSymbol: string;
  status: InvoiceStatus;
  companyId: string;
  bankAccountId: string | null;
  currency: Currency;
  exchangeRate: number;
  exchangeRateDate: string | null;
  issueDate: string;
  taxDate: string;
  dueDate: string;
  subject: string;
  note: string;
  sentAt: string | null;
  paidAt: string | null;
  offerNumber: string | null;
  caflouProjectId: string;
  projectName: string | null;
  rezimDph: 'STANDARD' | 'PRENESENA' | 'MIMO_PREDMET';
  jazyk: 'CS' | 'EN';
  items: Item[];
};

const VAT_RATES = [21, 12, 0];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rozpracovaná',
  SENT: 'Neuhrazená',
  PAID: 'Uhrazená',
  CANCELLED: 'Stornovaná',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  PAID: 'bg-okTint text-status-done',
  CANCELLED: 'bg-dangerTint text-danger',
};

function emptyItem(): Item {
  return { description: '', quantity: 1, unit: 'ks', unitPriceMinor: 0, vatRate: 21 };
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

/**
 * Editor faktury. Vypadá jako samotný doklad, stejně jako u nabídek.
 * U cizí měny je vidět kurz ČNB ke dni vystavení i přepočet do korun -
 * kurz se s dokladem ukládá, takže se pozdějším pohybem na trhu nezmění.
 */
export function InvoiceEditor({
  invoice,
  issuerCompanyId,
  issuer,
  company,
  companies,
  bankAccounts,
  projects,
  /**
   * ID nabidky, ze ktere se faktura chysta. Kdyz je vyplnene, faktura JESTE
   * NEEXISTUJE - editor jen ukazuje predvyplneny doklad a teprve tlacitko
   * Ulozit ho zalozi (zadani 8. 9. 2026: "chci se dostat jeste do editace
   * faktury a az pak ji ulozit"). Driv se faktura zalozila uz kliknutim na
   * "Vystavit fakturu", takze kazde rozmysleni si to nechavalo v seznamu
   * rozpracovany doklad a snedlo cislo z rady.
   */
  draftFromOfferId,
}: {
  invoice: Invoice;
  /** Vydavatel dokladu - kvuli nahledu, ktery si ho tahne ze serveru. */
  issuerCompanyId: string;
  issuer: Party;
  company: Party;
  companies: { id: string; name: string }[];
  bankAccounts: { id: string; label: string; accountNumber: string | null; iban: string | null; currency: Currency }[];
  projects: ProjectChoice[];
  draftFromOfferId?: string;
}) {
  const router = useRouter();
  // Neulozeny doklad: bud se chysta z nabidky, nebo se zaklada od nuly -
  // v obou pripadech jeste nema ani cislo, ani radek v databazi (zadani
  // 10. 9. 2026: cislo z rady se nesmi spotrebovat rozmyslenim).
  const jesteNeulozena = Boolean(draftFromOfferId) || invoice.id === 'nova';
  const locked = invoice.status === 'PAID' || invoice.status === 'CANCELLED';

  const [form, setForm] = useState({
    companyId: invoice.companyId,
    bankAccountId: invoice.bankAccountId ?? '',
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    taxDate: invoice.taxDate,
    dueDate: invoice.dueDate,
    subject: invoice.subject,
    note: invoice.note,
    variableSymbol: invoice.variableSymbol,
    caflouProjectId: invoice.caflouProjectId,
    rezimDph: invoice.rezimDph,
    jazyk: invoice.jazyk,
  });
  const [items, setItems] = useState<Item[]>(invoice.items.length > 0 ? invoice.items : [emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const totals = useMemo(() => computeTotals(items), [items]);

  /**
   * Co se posílá do náhledu. Je to schválně jen to, co je na dokumentu vidět -
   * kdyby se posílal celý stav, překresloval by se i po změnách, které se
   * dokumentu vůbec netýkají.
   */
  const nahledTelo = useMemo(
    () => ({
      druh: 'FAKTURA' as const,
      id: jesteNeulozena ? null : invoice.id,
      issuerCompanyId,
      companyId: form.companyId,
      bankAccountId: form.bankAccountId || null,
      currency: form.currency,
      issueDate: form.issueDate,
      taxDate: form.taxDate || null,
      dueDate: form.dueDate || null,
      subject: form.subject,
      note: form.note,
      variableSymbol: form.variableSymbol,
      projectName: projects.find((p) => p.id === form.caflouProjectId)?.label ?? invoice.projectName ?? null,
      rezimDph: form.rezimDph,
      jazyk: form.jazyk === 'EN' ? ('en' as const) : ('cs' as const),
      items: items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity) || 0,
        unit: i.unit,
        unitPriceMinor: i.unitPriceMinor,
        vatRate: i.vatRate,
      })),
    }),
    [form, items, invoice.id, invoice.projectName, issuerCompanyId, jesteNeulozena, projects],
  );
  const accountsForCurrency = bankAccounts.filter((a) => a.currency === form.currency);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setInfo(null);
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setInfo(null);
  }

  async function save(extra?: { refreshRate?: boolean }) {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const telo = {
        ...form,
        bankAccountId: form.bankAccountId || null,
        taxDate: form.taxDate || null,
        dueDate: form.dueDate || null,
        refreshRate: extra?.refreshRate,
        items: items
          .filter((i) => i.description.trim())
          .map((i) => ({
            description: i.description.trim(),
            quantity: Number(i.quantity) || 0,
            unit: i.unit || undefined,
            unitPriceMinor: i.unitPriceMinor,
            vatRate: i.vatRate,
          })),
      };
      const res = jesteNeulozena
        ? await fetch('/api/admin/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...telo, offerId: draftFromOfferId, issuerCompanyId }),
          })
        : await fetch(`/api/admin/invoices/${invoice.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telo),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return false;
      }
      if (jesteNeulozena && data?.id) {
        // Cislo z rady se pridelilo az ted - dal uz se pracuje s hotovou fakturou.
        router.replace(`/admin/doklady/faktury/${data.id}`);
        router.refresh();
        return true;
      }
      setInfo('Uloženo.');
      router.refresh();
      return true;
    } catch {
      setError('Uložení se nezdařilo.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendToClient() {
    const saved = await save();
    if (!saved) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Odeslání se nezdařilo.');
        return;
      }
      setInfo(`Faktura odeslána na ${data.to}.`);
      router.refresh();
    } catch {
      setError('Odeslání se nezdařilo.');
    } finally {
      setSending(false);
    }
  }

  async function setPaid(paid: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/uhrada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid, paidAmountMinor: paid ? totals.incVat : undefined }),
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
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Smazání se nezdařilo.');
        return;
      }
      if (data.cancelledInsteadOfDeleted) {
        setInfo('Faktura byla stornována — v číselné řadě po ní zůstává stopa, jak to má být.');
        router.refresh();
        return;
      }
      router.push('/admin/doklady/faktury');
      router.refresh();
    } catch {
      setError('Smazání se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:opacity-70';
  const cellClass =
    'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:bg-field disabled:opacity-70';

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display text-2xl text-ink">
            {jesteNeulozena ? 'Nová faktura' : invoice.number}
          </span>
          <span
            className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${STATUS_CLASSES[invoice.status]}`}
          >
            {jesteNeulozena ? 'Neuložená' : STATUS_LABELS[invoice.status]}
          </span>
          {invoice.offerNumber && (
            <span className="text-xs font-body text-muted">z nabídky {invoice.offerNumber}</span>
          )}
          {invoice.paidAt && (
            <span className="text-xs font-body text-status-done">Uhrazeno {formatDateTime(invoice.paidAt)}</span>
          )}
          {invoice.sentAt && !invoice.paidAt && (
            <span className="text-xs font-body text-muted">Odesláno {formatDateTime(invoice.sentAt)}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {jesteNeulozena && (
            <>
              <span className="text-xs font-body text-muted max-w-[280px]">
                Faktura se založí až tlačítkem Uložit — číslo z řady dostane teprve tehdy.
              </span>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="border border-line text-muted font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => save()}
                disabled={saving}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {saving ? 'Zakládám…' : 'Uložit fakturu'}
              </button>
            </>
          )}
          {!jesteNeulozena &&
            (invoice.status === 'PAID' ? (
            <button
              type="button"
              onClick={() => setPaid(false)}
              disabled={saving}
              className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
            >
              Zrušit úhradu
            </button>
          ) : (
              invoice.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => setPaid(true)}
                  disabled={saving}
                  className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:brightness-95 transition-[filter] disabled:opacity-60"
                >
                  Označit jako uhrazenou
                </button>
              )
            ))}
          {!locked && !jesteNeulozena && (
            <>
              <button
                type="button"
                onClick={sendToClient}
                disabled={saving || sending}
                className="border border-brand-purple text-brand-purple font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-tint transition-colors disabled:opacity-60"
              >
                {sending ? 'Odesílám…' : 'Odeslat odběrateli'}
              </button>
              <button
                type="button"
                onClick={() => save()}
                disabled={saving || sending}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* DVA SLOUPCE (zadani 10. 9. 2026): vlevo udaje, vpravo hotovy doklad.
          Stejny model jako u Rodneho listu - clovek vidi, co vyrabi, uz pri
          zakladani, ne az po ulozeni. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-5 items-start">
      <div className="flex flex-col gap-5 min-w-0">

      {locked && (
        <p className="text-sm text-ink bg-field border border-line rounded-lg px-4 py-3 m-0">
          {invoice.status === 'PAID'
            ? 'Faktura je uhrazená, takže se nedá měnit. Kdyby bylo potřeba, nejdřív zrušte úhradu.'
            : 'Faktura je stornovaná.'}
        </p>
      )}
      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{error}</p>}
      {info && <p className="text-sm text-ink bg-tint border border-line rounded-lg px-4 py-3 m-0">{info}</p>}

      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-b border-line">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Dodavatel</span>
            <p className="font-heading font-semibold text-ink m-0">{issuer.name}</p>
            <p className="text-sm font-body text-muted m-0">
              {formatAddress(issuer) || '—'}
              <br />
              {issuer.ic ? `IČ ${issuer.ic}` : ''} {issuer.dic ? `· DIČ ${issuer.dic}` : ''}
              {issuer.vatPayer === false ? ' · neplátce DPH' : ''}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Odběratel</span>
            {locked ? (
              <p className="font-heading font-semibold text-ink m-0">{company.name}</p>
            ) : (
              <select value={form.companyId} onChange={(e) => set('companyId', e.target.value)} className={inputClass}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-sm font-body text-muted m-0">
              {formatAddress(company) || '—'}
              <br />
              {company.ic ? `IČ ${company.ic}` : ''} {company.dic ? `· DIČ ${company.dic}` : ''}
            </p>
            {!company.contactEmail && (
              <p className="text-xs text-danger font-body m-0">
                Firma nemá kontaktní e-mail — bez něj fakturu nepošlete.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b border-line">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Název</span>
            <input
              value={form.subject}
              disabled={locked}
              onChange={(e) => set('subject', e.target.value)}
              className={inputClass}
            />
          </label>
          {/* Projekt (zadani 8. 9. 2026) - faktura je pak videt v detailu projektu.
              Z nabidky se predvyplni sama. */}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Projekt</span>
            <ProjectSelect
              value={form.caflouProjectId}
              onChange={(id) => set('caflouProjectId', id)}
              projects={projects}
              currentName={invoice.projectName}
              disabled={locked}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Variabilní symbol</span>
            <input
              value={form.variableSymbol}
              disabled={locked}
              onChange={(e) => set('variableSymbol', e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className={`${inputClass} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Měna</span>
            <select
              value={form.currency}
              disabled={locked}
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

          {/* Rezim DPH VYBIRA CLOVEK (zadani 10. 9. 2026) - portal ho nehada
              z adresy odberatele, protoze to je vec ucetni, ne adresy. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Režim DPH</span>
            <select
              value={form.rezimDph}
              disabled={locked}
              onChange={(e) => set('rezimDph', e.target.value as typeof form.rezimDph)}
              className={inputClass}
            >
              <option value="STANDARD">Běžný — sazby podle položek</option>
              <option value="PRENESENA">Přenesená daňová povinnost</option>
              <option value="MIMO_PREDMET">Mimo předmět DPH v ČR</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Jazyk dokladu</span>
            <select
              value={form.jazyk}
              disabled={locked}
              onChange={(e) => set('jazyk', e.target.value as typeof form.jazyk)}
              className={inputClass}
            >
              <option value="CS">Čeština</option>
              <option value="EN">Angličtina</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Vystaveno</span>
            <input
              type="date"
              value={form.issueDate}
              disabled={locked}
              onChange={(e) => set('issueDate', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Datum zdanitelného plnění</span>
            <input
              type="date"
              value={form.taxDate}
              disabled={locked}
              onChange={(e) => set('taxDate', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Splatnost</span>
            <input
              type="date"
              value={form.dueDate}
              disabled={locked}
              onChange={(e) => set('dueDate', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Účet</span>
            <select
              value={form.bankAccountId}
              disabled={locked}
              onChange={(e) => set('bankAccountId', e.target.value)}
              className={inputClass}
            >
              <option value="">— vyberte účet —</option>
              {accountsForCurrency.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {[a.accountNumber, a.iban].filter(Boolean).join(' / ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Kurz ČNB - jen u cizí měny */}
        {form.currency !== 'CZK' && (
          <div className="px-6 py-4 border-b border-line bg-field flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Kurz ČNB</span>
              <p className="text-sm font-heading text-ink m-0 mt-0.5 tabular-nums">
                1 {form.currency} = {formatRate(invoice.exchangeRate)} Kč
                {invoice.exchangeRateDate && (
                  <span className="text-muted font-body">
                    {' '}
                    ke dni {new Intl.DateTimeFormat('cs-CZ').format(new Date(invoice.exchangeRateDate))}
                  </span>
                )}
              </p>
            </div>
            {!locked && (
              <button
                type="button"
                onClick={() => save({ refreshRate: true })}
                disabled={saving}
                className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-surface transition-colors disabled:opacity-60"
              >
                Načíst kurz k datu vystavení
              </button>
            )}
          </div>
        )}

        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Položky</h2>
            <span className="text-xs font-body text-muted">Ceny se zadávají bez DPH.</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                  <th className="text-left pb-2 font-semibold">Popis</th>
                  <th className="text-right pb-2 font-semibold w-24">Množství</th>
                  <th className="text-left pb-2 font-semibold w-20">Jednotka</th>
                  <th className="text-right pb-2 font-semibold w-32">Cena / j.</th>
                  <th className="text-right pb-2 font-semibold w-24">DPH</th>
                  <th className="text-right pb-2 font-semibold w-32">Celkem</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="align-top">
                    <td className="py-1.5 pr-2">
                      <input
                        value={item.description}
                        disabled={locked}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                        placeholder="Popis položky"
                        className={cellClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        inputMode="decimal"
                        value={item.quantity}
                        disabled={locked}
                        onChange={(e) =>
                          updateItem(index, { quantity: Number(e.target.value.replace(',', '.')) || 0 })
                        }
                        className={`${cellClass} text-right tabular-nums`}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={item.unit}
                        disabled={locked}
                        onChange={(e) => updateItem(index, { unit: e.target.value })}
                        className={cellClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        inputMode="decimal"
                        defaultValue={minorToInput(item.unitPriceMinor)}
                        disabled={locked}
                        onChange={(e) => updateItem(index, { unitPriceMinor: parseMoneyToMinor(e.target.value) })}
                        className={`${cellClass} text-right tabular-nums`}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={item.vatRate}
                        disabled={locked}
                        onChange={(e) => updateItem(index, { vatRate: Number(e.target.value) })}
                        className={`${cellClass} text-right`}
                      >
                        {VAT_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r} %
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 text-right text-sm font-heading text-ink tabular-nums pt-3.5">
                      {formatMoney(Math.round(item.quantity * item.unitPriceMinor), form.currency)}
                    </td>
                    <td className="py-1.5 text-right pt-3">
                      {!locked && (
                        <button
                          type="button"
                          onClick={() =>
                            setItems((current) =>
                              current.length === 1 ? [emptyItem()] : current.filter((_, i) => i !== index),
                            )
                          }
                          title="Odebrat položku"
                          className="text-muted hover:text-danger text-sm font-heading"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!locked && (
            <AddButton
              type="button"
              onClick={() => setItems((current) => [...current, emptyItem()])}
              className="self-start"
            >
              Přidat položku
            </AddButton>
          )}
        </div>

        <div className="border-t border-line p-6 flex justify-end">
          <div className="w-full max-w-xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm font-heading">
              <span className="text-muted">Základ bez DPH</span>
              <span className="text-ink tabular-nums">{formatMoney(totals.exVat, form.currency)}</span>
            </div>
            {totals.byRate.map((r) => (
              <div key={r.rate} className="flex items-center justify-between text-sm font-heading">
                <span className="text-muted">DPH {r.rate} %</span>
                <span className="text-muted tabular-nums">{formatMoney(r.vat, form.currency)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line pt-2 mt-1">
              <span className="font-heading font-semibold text-ink">K úhradě</span>
              <span className="font-display text-xl text-ink tabular-nums">
                {formatMoney(totals.incVat, form.currency)}
              </span>
            </div>
            {form.currency !== 'CZK' && (
              <div className="flex items-center justify-between text-xs font-body text-muted">
                <span>v korunách kurzem ČNB</span>
                <span className="tabular-nums">
                  {formatMoney(toCzkMinor(totals.incVat, invoice.exchangeRate), 'CZK')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">Poznámka na faktuře</span>
        <textarea
          value={form.note}
          disabled={locked}
          onChange={(e) => set('note', e.target.value)}
          rows={3}
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full disabled:opacity-70"
        />
      </div>

      </div>

      <NahledDokladu telo={nahledTelo} titulek="Náhled faktury" />
      </div>

      {invoice.status !== 'CANCELLED' && !jesteNeulozena && (
        <div>
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="text-danger text-sm font-heading disabled:opacity-60"
          >
            {invoice.status === 'DRAFT' ? 'Smazat fakturu' : 'Stornovat fakturu'}
          </button>
        </div>
      )}
    </div>
  );
}
