'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Currency, OfferStatus } from '@prisma/client';
import { ProjectSelect, type ProjectChoice } from '../../ProjectSelect';
import {
  CURRENCIES,
  CURRENCY_LABELS,
  CURRENCY_NAMES,
  computeTotals,
  formatMoney,
  minorToInput,
  parseMoneyToMinor,
  OFFER_STATUS_CLASSES,
  OFFER_STATUS_LABELS,
  formatAddress,
} from '@/lib/doklady';

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

type Offer = {
  id: string;
  number: string;
  status: OfferStatus;
  issuerCompanyId: string;
  companyId: string;
  currency: Currency;
  issueDate: string;
  validUntil: string;
  subject: string;
  note: string;
  approvalToken: string;
  sentAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  caflouProjectId: string;
  projectName: string | null;
  items: Item[];
};

const VAT_RATES = [21, 12, 0];

function emptyItem(): Item {
  return { description: '', quantity: 1, unit: 'ks', unitPriceMinor: 0, vatRate: 21 };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Editor nabídky. Vypadá jako samotný doklad — hlavička s oběma firmami,
 * pod ní položky a součet — a edituje se v něm přímo, aby bylo pořád vidět,
 * co klient dostane (zadani 8. 9. 2026: "ať je vše přehledné a intuitivní").
 */
export function OfferEditor({
  offer,
  issuer,
  company,
  issuers,
  companies,
  bankAccounts,
  projects,
}: {
  offer: Offer;
  issuer: Party;
  company: Party;
  issuers: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  bankAccounts: { label: string; accountNumber: string | null; iban: string | null }[];
  projects: ProjectChoice[];
}) {
  const router = useRouter();
  const locked = offer.status === 'APPROVED';

  const [form, setForm] = useState({
    issuerCompanyId: offer.issuerCompanyId,
    companyId: offer.companyId,
    currency: offer.currency,
    issueDate: offer.issueDate,
    validUntil: offer.validUntil,
    subject: offer.subject,
    note: offer.note,
    caflouProjectId: offer.caflouProjectId,
  });
  const [items, setItems] = useState<Item[]>(offer.items.length > 0 ? offer.items : [emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const totals = useMemo(() => computeTotals(items), [items]);
  const approvalUrl = typeof window !== 'undefined' ? `${window.location.origin}/nabidka/${offer.approvalToken}` : '';

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setInfo(null);
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setInfo(null);
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? [emptyItem()] : current.filter((_, i) => i !== index)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          validUntil: form.validUntil || null,
          items: items
            .filter((i) => i.description.trim())
            .map((i) => ({
              description: i.description.trim(),
              quantity: Number(i.quantity) || 0,
              unit: i.unit || undefined,
              unitPriceMinor: i.unitPriceMinor,
              vatRate: i.vatRate,
            })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return false;
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
      const res = await fetch(`/api/admin/offers/${offer.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Odeslání se nezdařilo.');
        return;
      }
      setInfo(`Nabídka odeslána na ${data.to}.`);
      router.refresh();
    } catch {
      setError('Odeslání se nezdařilo.');
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(approvalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Odkaz se nepodařilo zkopírovat — schránka není dostupná.');
    }
  }

  /**
   * Faktura z nabídky. Nic se tu nezakládá - otevře se předvyplněný doklad
   * k úpravě a teprve tam se uloží (zadani 8. 9. 2026: "chci se dostat ještě
   * do editace faktury a až pak ji uložit"). Dřív klik rovnou založil
   * rozpracovanou fakturu a snědl číslo z řady.
   */
  function createInvoice() {
    router.push(`/admin/doklady/faktury/nova?nabidka=${offer.id}`);
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Smazání se nezdařilo.');
        return;
      }
      router.push('/admin/doklady/nabidky');
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
    'rounded-lg border border-line bg-white px-2.5 py-1.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:bg-field disabled:opacity-70';

  return (
    <div className="flex flex-col gap-5">
      {/* Lišta se stavem a akcemi - drží se nahoře, aby byla pořád po ruce. */}
      <div className="bg-white rounded-card border border-line shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display text-2xl text-ink">{offer.number}</span>
          <span
            className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${OFFER_STATUS_CLASSES[offer.status]}`}
          >
            {OFFER_STATUS_LABELS[offer.status]}
          </span>
          {offer.approvedAt && (
            <span className="text-xs font-body text-muted">
              Schváleno {formatDateTime(offer.approvedAt)}
              {offer.approvedByName ? ` — ${offer.approvedByName}` : ''}
            </span>
          )}
          {offer.rejectedAt && !offer.approvedAt && (
            <span className="text-xs font-body text-red-600">Odmítnuto {formatDateTime(offer.rejectedAt)}</span>
          )}
          {offer.sentAt && !offer.approvedAt && !offer.rejectedAt && (
            <span className="text-xs font-body text-muted">Odesláno {formatDateTime(offer.sentAt)}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={copyLink}
            className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors"
          >
            {copied ? 'Zkopírováno' : 'Odkaz pro klienta'}
          </button>
          {/* Fakturu jde vystavit z kazde nabidky, kterou klient neodmitl
              (zadani 8. 9. 2026) - schvaleni pres odkaz je dobrovolne a
              casto se domlouva telefonem. */}
          {offer.status !== 'REJECTED' && (
            <button
              type="button"
              onClick={createInvoice}
              disabled={saving || sending}
              className="border border-brand-green bg-[#E3F9EC] text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-green transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              Vystavit fakturu
            </button>
          )}
          {!locked && (
            <>
              <button
                type="button"
                onClick={sendToClient}
                disabled={saving || sending}
                className="border border-brand-purple text-brand-purple font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-[#F1ECFF] transition-colors disabled:opacity-60"
              >
                {sending ? 'Odesílám…' : 'Odeslat klientovi'}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || sending}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
            </>
          )}
        </div>
      </div>

      {locked && (
        <div className="bg-[#E3F9EC] border border-line rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-ink m-0">
            Nabídku klient schválil, takže už se nedá měnit — zůstává přesně v podobě, kterou odsouhlasil.
            Fakturu z ní vystavíte tlačítkem nahoře.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-4 py-3 m-0">{error}</p>}
      {info && <p className="text-sm text-ink bg-[#F1ECFF] border border-line rounded-lg px-4 py-3 m-0">{info}</p>}

      {/* Vlastní doklad */}
      <div className="bg-white rounded-card border border-line shadow-sm overflow-hidden">
        {/* Hlavička: dodavatel vs. odběratel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-b border-line">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Dodavatel</span>
            {locked ? (
              <p className="font-heading font-semibold text-ink m-0">{issuer.name}</p>
            ) : (
              <select
                value={form.issuerCompanyId}
                onChange={(e) => set('issuerCompanyId', e.target.value)}
                className={inputClass}
              >
                {issuers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            )}
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
              <p className="text-xs text-red-600 font-body m-0">
                Firma nemá kontaktní e-mail — bez něj nabídku nepošlete.
              </p>
            )}
          </div>
        </div>

        {/* Předmět a data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b border-line">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Název</span>
            <input
              value={form.subject}
              disabled={locked}
              onChange={(e) => set('subject', e.target.value)}
              placeholder="např. Výroba audioknihy Tři mušketýři"
              className={inputClass}
            />
          </label>
          {/* Projekt (zadani 8. 9. 2026) - nabidka se pak ukaze v detailu projektu
              a vazba se prenese i na fakturu z ni vystavenou. */}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">Projekt</span>
            <ProjectSelect
              value={form.caflouProjectId}
              onChange={(id) => set('caflouProjectId', id)}
              projects={projects}
              currentName={offer.projectName}
              disabled={locked}
              className={inputClass}
            />
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
            <span className="text-sm font-body text-ink">Platnost do</span>
            <input
              type="date"
              value={form.validUntil}
              disabled={locked}
              onChange={(e) => set('validUntil', e.target.value)}
              className={inputClass}
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
        </div>

        {/* Položky */}
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
                        placeholder="ks"
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
                          onClick={() => removeItem(index)}
                          title="Odebrat položku"
                          className="text-muted hover:text-red-600 text-sm font-heading"
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
            <button
              type="button"
              onClick={addItem}
              className="border border-brand-purple text-brand-purple font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-[#F1ECFF] transition-colors self-start"
            >
              + Přidat položku
            </button>
          )}
        </div>

        {/* Součet */}
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
              <span className="font-heading font-semibold text-ink">Celkem</span>
              <span className="font-display text-xl text-ink tabular-nums">
                {formatMoney(totals.incVat, form.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Poznámka a účet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Poznámka pro klienta</span>
          <textarea
            value={form.note}
            disabled={locked}
            onChange={(e) => set('note', e.target.value)}
            rows={4}
            placeholder="Co je v ceně, termíny, podmínky…"
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full disabled:opacity-70"
          />
        </div>

        <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            Bankovní účet ({CURRENCY_LABELS[form.currency]})
          </span>
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-muted font-body m-0">
              Pro tuhle měnu není u vaší firmy žádný účet. Doplňte ho v Moje firmy — na faktuře bude potřeba.
            </p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-1">
              {bankAccounts.map((a, i) => (
                <li key={i} className="text-sm font-heading text-ink">
                  {a.label}
                  <span className="block text-xs text-muted font-body tabular-nums">
                    {[a.accountNumber, a.iban].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!locked && (
        <div>
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="text-red-600 text-sm font-heading disabled:opacity-60"
          >
            Smazat nabídku
          </button>
        </div>
      )}
    </div>
  );
}
