'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Currency } from '@prisma/client';
import { AdminField } from '../../../NewCompanyForm';
import { CountrySelect } from '../../../CountrySelect';
import { CURRENCIES, nazevMeny, previewNumbers } from '@/lib/doklady';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { VyberPole } from '@/components/VyberPole';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

type Issuer = {
  id: string;
  name: string;
  ic: string | null;
  dic: string | null;
  vatPayer: boolean;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  email: string | null;
  phone: string | null;
  invoiceNumberFormat: string;
  invoiceNextNumber: number;
  offerNumberFormat: string;
  offerNextNumber: number;
  contractNumberFormat: string;
  contractNextNumber: number;
  defaultCurrency: Currency;
  isDefault: boolean;
  active: boolean;
};

/**
 * Věta o zástupných znacích je JEDEN klíč (pravidlo 7 v docs/preklad-portalu.md);
 * značky {kod1}…{kod4} se při vykreslení promění v <code> se zástupným znakem.
 */
function sKody(veta: string, kody: Record<string, string>) {
  return veta.split(/(\{kod\d\})/).map((cast, i) => {
    const znacka = cast.match(/^\{(kod\d)\}$/);
    return znacka ? <code key={i}>{kody[znacka[1]]}</code> : <span key={i}>{cast}</span>;
  });
}

/**
 * Údaje vlastní firmy a číselné řady. Řada se nastavuje formátem se zástupnými
 * znaky a pořadovým číslem - právě kvůli přechodu z Caflou, aby šlo navázat
 * tam, kde tamní řada skončila (zadani 8. 9. 2026).
 */
export function IssuerForm({ issuer }: { issuer: Issuer }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [form, setForm] = useState({
    name: issuer.name,
    ic: issuer.ic ?? '',
    dic: issuer.dic ?? '',
    vatPayer: issuer.vatPayer,
    addressStreet: issuer.addressStreet ?? '',
    addressCity: issuer.addressCity ?? '',
    addressZip: issuer.addressZip ?? '',
    addressCountry: issuer.addressCountry ?? DEFAULT_COUNTRY,
    email: issuer.email ?? '',
    phone: issuer.phone ?? '',
    invoiceNumberFormat: issuer.invoiceNumberFormat,
    invoiceNextNumber: String(issuer.invoiceNextNumber),
    offerNumberFormat: issuer.offerNumberFormat,
    offerNextNumber: String(issuer.offerNextNumber),
    contractNumberFormat: issuer.contractNumberFormat,
    contractNextNumber: String(issuer.contractNextNumber),
    defaultCurrency: issuer.defaultCurrency,
    isDefault: issuer.isDefault,
    active: issuer.active,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/issuers/${issuer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('mojeFirmy.ulozeniSelhalo'));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t('mojeFirmy.ulozeniSelhalo'));
    } finally {
      setSaving(false);
    }
  }

  const invoicePreview = previewNumbers(form.invoiceNumberFormat, Number(form.invoiceNextNumber) || 1);
  const contractPreview = previewNumbers(form.contractNumberFormat, Number(form.contractNextNumber) || 1);
  const offerPreview = previewNumbers(form.offerNumberFormat, Number(form.offerNextNumber) || 1);

  return (
    <form onSubmit={submit} className="bg-surface border border-line rounded-card p-6 flex flex-col gap-4 shadow-sm">
      <h2 className="font-display text-xl text-ink m-0">{issuer.name}</h2>

      <AdminField label={t('mojeFirmy.nazevFirmy')} required hint={t('mojeFirmy.nazevFirmyNapoveda')}>
        <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="admin-input" />
      </AdminField>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('mojeFirmy.ic')}>
            <input value={form.ic} onChange={(e) => set('ic', e.target.value)} inputMode="numeric" className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('mojeFirmy.dic')}>
            <input value={form.dic} onChange={(e) => set('dic', e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={form.vatPayer} onChange={(e) => set('vatPayer', e.target.checked)} />
        {t('mojeFirmy.platceDph')}
      </label>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-[2] min-w-[220px]">
          <AdminField label={t('mojeFirmy.ulice')}>
            <input value={form.addressStreet} onChange={(e) => set('addressStreet', e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[120px]">
          <AdminField label={t('mojeFirmy.psc')}>
            <input value={form.addressZip} onChange={(e) => set('addressZip', e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('mojeFirmy.mesto')}>
            <input value={form.addressCity} onChange={(e) => set('addressCity', e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('mojeFirmy.zeme')}>
            <CountrySelect value={form.addressCountry} onChange={(v) => set('addressCountry', v)} />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('mojeFirmy.emailOdesilatele')} hint={t('mojeFirmy.emailOdesilateleNapoveda')}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('mojeFirmy.telefon')}>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {/* --- Číselné řady --------------------------------------------------- */}
      <div className="border-t border-line pt-4 mt-2 flex flex-col gap-4">
        <div>
          <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('mojeFirmy.ciselneRady')}
          </h3>
          <p className="text-xs text-muted font-body mt-1 m-0">
            {sKody(t('mojeFirmy.ciselneRadyPopis'), {
              kod1: '{YYYY}',
              kod2: '{YY}',
              kod3: '{MM}',
              kod4: '{NNN}',
            })}
          </p>
        </div>

        <div className="flex gap-4 flex-wrap items-start">
          <div className="flex-1 min-w-[200px]">
            <AdminField label={t('mojeFirmy.formatFaktury')}>
              <input value={form.invoiceNumberFormat} onChange={(e) => set('invoiceNumberFormat', e.target.value)} className="admin-input" />
            </AdminField>
          </div>
          <div className="flex-1 min-w-[140px]">
            <AdminField label={t('mojeFirmy.dalsiCislo')}>
              <input
                value={form.invoiceNextNumber}
                onChange={(e) => set('invoiceNextNumber', e.target.value)}
                inputMode="numeric"
                className="admin-input"
              />
            </AdminField>
          </div>
          <div className="flex-1 min-w-[180px] pt-6">
            <p className="text-xs font-heading text-muted m-0">{t('mojeFirmy.vyjde')} </p>
            <p className="text-sm font-heading text-ink tabular-nums m-0">{invoicePreview.join(', ')}…</p>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap items-start">
          <div className="flex-1 min-w-[200px]">
            <AdminField label={t('mojeFirmy.formatNabidky')}>
              <input value={form.offerNumberFormat} onChange={(e) => set('offerNumberFormat', e.target.value)} className="admin-input" />
            </AdminField>
          </div>
          <div className="flex-1 min-w-[140px]">
            <AdminField label={t('mojeFirmy.dalsiCislo')}>
              <input
                value={form.offerNextNumber}
                onChange={(e) => set('offerNextNumber', e.target.value)}
                inputMode="numeric"
                className="admin-input"
              />
            </AdminField>
          </div>
          <div className="flex-1 min-w-[180px] pt-6">
            <p className="text-xs font-heading text-muted m-0">{t('mojeFirmy.vyjde')} </p>
            <p className="text-sm font-heading text-ink tabular-nums m-0">{offerPreview.join(', ')}…</p>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap items-start">
          <div className="flex-1 min-w-[200px]">
            <AdminField label={t('mojeFirmy.formatSmlouvy')}>
              <input
                value={form.contractNumberFormat}
                onChange={(e) => set('contractNumberFormat', e.target.value)}
                className="admin-input"
              />
            </AdminField>
          </div>
          <div className="flex-1 min-w-[140px]">
            <AdminField label={t('mojeFirmy.dalsiCislo')}>
              <input
                value={form.contractNextNumber}
                onChange={(e) => set('contractNextNumber', e.target.value)}
                inputMode="numeric"
                className="admin-input"
              />
            </AdminField>
          </div>
          <div className="flex-1 min-w-[180px] pt-6">
            <p className="text-xs font-heading text-muted m-0">{t('mojeFirmy.vyjde')} </p>
            <p className="text-sm font-heading text-ink tabular-nums m-0">{contractPreview.join(', ')}…</p>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <AdminField label={t('mojeFirmy.vychoziMena')}>
              <VyberPole
                value={form.defaultCurrency}
                onChange={(e) => set('defaultCurrency', e.target.value as Currency)}
                className="admin-input"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {nazevMeny(c, jazyk)}
                  </option>
                ))}
              </VyberPole>
            </AdminField>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <label className="flex items-center gap-2 text-sm font-heading text-ink">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
          {t('mojeFirmy.vychoziFirma')}
        </label>
        <label className="flex items-center gap-2 text-sm font-heading text-ink">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          {t('mojeFirmy.aktivni')}
        </label>
      </div>

      {error && <p className="text-danger text-sm m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? t('obecne.ukladam') : t('mojeFirmy.ulozitZmeny')}
        </button>
        {saved && <span className="text-status-done text-sm font-heading">{t('mojeFirmy.ulozeno')}</span>}
      </div>
    </form>
  );
}
