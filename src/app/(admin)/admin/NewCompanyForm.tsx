'use client';

import { useState } from 'react';
import { Volba } from '@/components/Volba';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { CompanyType } from '@prisma/client';
import { CountrySelect } from './CountrySelect';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';
import { VyberPole } from '@/components/VyberPole';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

// Firmy se od 5. 9. 2026 deli na Klienty a Dodavatele (CompanyType) - typ se
// prednastavi podle zalozky, na ktere admin prave je (viz page.tsx), pole
// formulare se pak podle typu lisi (viz schema.prisma > model Company).
//
// Od 8. 9. 2026 je uz i tady IC a tlacitko "Nacist z registru" (zadani:
// "když zakládám novou firmu, není tam IČ, aby se načetla z registru") - firma
// jde tedy zalozit rovnou s fakturacnimi udaji, bez otevirani detailu.
export function NewCompanyForm({ defaultType }: { defaultType: CompanyType }) {
  const t = usePreklad();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Prisel sem clovek pres rychlou volbu z leveho panelu? Pak rovnou
  // rozbalit - zkratka ma vest do editacniho okna, ne jen na stranku
  // (zadani 9. 9. 2026).
  useOtevriZeZkratky(() => setOpen(true));
  const [type, setType] = useState<CompanyType>(defaultType);
  const [name, setName] = useState('');

  // Fakturacni udaje - spolecne pro klienta i dodavatele.
  const [ic, setIc] = useState('');
  const [dic, setDic] = useState('');
  const [vatPayer, setVatPayer] = useState(false);
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressCountry, setAddressCountry] = useState(DEFAULT_COUNTRY);
  const [bankAccount, setBankAccount] = useState('');

  // Klient
  const [rate, setRate] = useState('');
  const [caflouCompanyId, setCaflouCompanyId] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  // Druh zakazek (zadani 12. 9. 2026) - podle tohoto se klientovi na
  // /objednavka zobrazi jen prislusny typ objednavky.
  const [dealsAudiobooks, setDealsAudiobooks] = useState(true);
  const [dealsAds, setDealsAds] = useState(false);

  // Kontakt
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aresBusy, setAresBusy] = useState(false);
  const [aresNote, setAresNote] = useState<string | null>(null);

  function resetFields() {
    setName('');
    setIc('');
    setDic('');
    setVatPayer(false);
    setAddressStreet('');
    setAddressCity('');
    setAddressZip('');
    setAddressCountry(DEFAULT_COUNTRY);
    setBankAccount('');
    setRate('');
    setCaflouCompanyId('');
    setDriveUrl('');
    setDealsAudiobooks(true);
    setDealsAds(false);
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setAresNote(null);
  }

  /** Doplneni nazvu, DIC a adresy z verejneho registru podle IC. */
  async function loadFromAres() {
    setAresBusy(true);
    setAresNote(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ares?ico=${encodeURIComponent(ic)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('firmy.registrSelhal'));
        return;
      }
      if (data.name) setName(data.name);
      if (data.dic) setDic(data.dic);
      if (data.vatPayer !== undefined) setVatPayer(Boolean(data.vatPayer));
      if (data.addressStreet) setAddressStreet(data.addressStreet);
      if (data.addressCity) setAddressCity(data.addressCity);
      if (data.addressZip) setAddressZip(data.addressZip);
      if (data.addressCountry) setAddressCountry(data.addressCountry);
      setAresNote(t('firmy.registrDoplneno'));
    } catch {
      setError(t('firmy.registrSelhal'));
    } finally {
      setAresBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const common = {
        type,
        name,
        ic,
        dic,
        vatPayer,
        bankAccount,
        addressStreet,
        addressCity,
        addressZip,
        addressCountry,
        contactName,
        contactEmail,
        contactPhone,
      };
      const body =
        type === 'KLIENT'
          ? {
              ...common,
              ratePerPage: dealsAudiobooks ? rate : '',
              caflouCompanyId,
              driveFolderUrl: driveUrl,
              dealsAudiobooks,
              dealsAds,
            }
          : common;

      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t('firmy.zalozeniSelhalo'));
      }
      resetFields();
      setOpen(false);
      // Zpet na seznam prislusne zalozky, aby byla nova firma hned videt.
      router.push(`/admin?tab=${type === 'KLIENT' ? 'klienti' : 'dodavatele'}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('firmy.zalozeniSelhalo'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <span id={KOTVA_NOVE}>
        <AddButton onClick={() => setOpen(true)} className="self-start">
        {t(defaultType === 'KLIENT' ? 'firmy.novyKlient' : 'firmy.novyDodavatel')}
        </AddButton>
      </span>
    );
  }

  return (
    <form id={KOTVA_NOVE} onSubmit={handleSubmit} className="bg-surface border border-line rounded-card p-6 flex flex-col gap-4 max-w-2xl">
      <h2 className="font-display text-xl text-ink m-0">
        {t(type === 'KLIENT' ? 'firmy.novyKlient' : 'firmy.novyDodavatel')}
      </h2>

      <AdminField label={t('firmy.typFirmy')} required>
        <VyberPole value={type} onChange={(e) => setType(e.target.value as CompanyType)} className="admin-input">
          <option value="KLIENT">{t('firmy.klient')}</option>
          <option value="DODAVATEL">{t('firmy.dodavatel')}</option>
        </VyberPole>
      </AdminField>

      {/* IC hned nahore - kdyz ho admin zna, zbytek se doplni z registru sam. */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('firmy.ic')} hint={t('firmy.icNapoveda')}>
            <input value={ic} onChange={(e) => setIc(e.target.value)} inputMode="numeric" className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('firmy.dic')}>
            <input value={dic} onChange={(e) => setDic(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <button
          type="button"
          onClick={loadFromAres}
          disabled={aresBusy || ic.replace(/\D/g, '').length !== 8}
          title={t('firmy.nacistZRegistruTitle')}
          className="bg-surface border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-field transition-colors disabled:opacity-40 mb-[26px]"
        >
          {aresBusy ? t('obecne.nacitam') : t('firmy.nacistZRegistru')}
        </button>
      </div>

      {aresNote && <p className="text-sm text-brand-greenDeep m-0">{aresNote}</p>}

      <AdminField label={t('firmy.nazevFirmy')} required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        {t('firmy.platceDph')}
      </label>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-[2] min-w-[220px]">
          <AdminField label={t('firmy.ulice')}>
            <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[120px]">
          <AdminField label={t('firmy.psc')}>
            <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('firmy.mesto')}>
            <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('firmy.zeme')}>
            <CountrySelect value={addressCountry} onChange={setAddressCountry} />
          </AdminField>
        </div>
      </div>

      <AdminField label={t('firmy.cisloUctu')}>
        <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="admin-input" />
      </AdminField>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <AdminField label={t('firmy.sl.kontaktniOsoba')}>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label={t('firmy.email')}>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label={t('firmy.telefon')}>
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {type === 'KLIENT' && (
        <>
          <AdminField label={t('firmy.druhZakazek')} hint={t('firmy.druhZakazekNapoveda')}>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-2">
                <Volba vybrano={dealsAudiobooks} onZmena={setDealsAudiobooks}>
                  {t('firmy.audioknihy')}
                </Volba>
                <Volba vybrano={dealsAds} onZmena={setDealsAds}>
                  {t('firmy.reklamy')}
                </Volba>
              </div>
            </div>
          </AdminField>

          {/* Sazba za normostranu dava smysl jen u audioknih - u reklamnich
              klientu se cena pocita z Ceniku. */}
          {dealsAudiobooks && (
            <AdminField label={t('firmy.sazbaZaNs')} required>
              <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
            </AdminField>
          )}

          <AdminField label={t('firmy.caflouId')} hint={t('firmy.caflouIdNapoveda')}>
            <input
              value={caflouCompanyId}
              onChange={(e) => setCaflouCompanyId(e.target.value)}
              placeholder={t('firmy.caflouIdPriklad')}
              className="admin-input"
            />
          </AdminField>

          <AdminField label={t('firmy.odkazNaDisk')}>
            <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" className="admin-input" />
          </AdminField>
        </>
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <AddButton type="submit" disabled={saving}>
          {saving ? t('obecne.ukladam') : t('firmy.ulozitFirmu')}
        </AddButton>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          {t('obecne.zrusit')}
        </button>
      </div>
    </form>
  );
}

export function AdminField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-heading font-medium text-ink">
        {label}
        {required && <span className="text-brand-purple ml-0.5">*</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-muted font-body">{hint}</span>}
    </div>
  );
}
