'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { CompanyType } from '@prisma/client';
import { CountrySelect } from './CountrySelect';
import { DEFAULT_COUNTRY } from '@/lib/countries';

// Firmy se od 5. 9. 2026 deli na Klienty a Dodavatele (CompanyType) - typ se
// prednastavi podle zalozky, na ktere admin prave je (viz page.tsx), pole
// formulare se pak podle typu lisi (viz schema.prisma > model Company).
//
// Od 8. 9. 2026 je uz i tady IC a tlacitko "Nacist z registru" (zadani:
// "když zakládám novou firmu, není tam IČ, aby se načetla z registru") - firma
// jde tedy zalozit rovnou s fakturacnimi udaji, bez otevirani detailu.
export function NewCompanyForm({ defaultType }: { defaultType: CompanyType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        setError(data?.error || 'Načtení z registru se nezdařilo.');
        return;
      }
      if (data.name) setName(data.name);
      if (data.dic) setDic(data.dic);
      if (data.vatPayer !== undefined) setVatPayer(Boolean(data.vatPayer));
      if (data.addressStreet) setAddressStreet(data.addressStreet);
      if (data.addressCity) setAddressCity(data.addressCity);
      if (data.addressZip) setAddressZip(data.addressZip);
      if (data.addressCountry) setAddressCountry(data.addressCountry);
      setAresNote('Údaje z registru doplněny — zkontrolujte a uložte.');
    } catch {
      setError('Načtení z registru se nezdařilo.');
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
        throw new Error(errBody.error || 'Firmu se nepodařilo založit.');
      }
      resetFields();
      setOpen(false);
      // Zpet na seznam prislusne zalozky, aby byla nova firma hned videt.
      router.push(`/admin?tab=${type === 'KLIENT' ? 'klienti' : 'dodavatele'}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firmu se nepodařilo založit.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <AddButton onClick={() => setOpen(true)} className="self-start">
        {defaultType === 'KLIENT' ? 'Nový klient' : 'Nový dodavatel'}
      </AddButton>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4 max-w-2xl">
      <h2 className="font-display text-xl text-ink m-0">{type === 'KLIENT' ? 'Nový klient' : 'Nový dodavatel'}</h2>

      <AdminField label="Typ firmy" required>
        <select value={type} onChange={(e) => setType(e.target.value as CompanyType)} className="admin-input">
          <option value="KLIENT">Klient</option>
          <option value="DODAVATEL">Dodavatel</option>
        </select>
      </AdminField>

      {/* IC hned nahore - kdyz ho admin zna, zbytek se doplni z registru sam. */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[140px]">
          <AdminField label="IČ" hint="vyplňte a načtěte zbytek z registru">
            <input value={ic} onChange={(e) => setIc(e.target.value)} inputMode="numeric" className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[140px]">
          <AdminField label="DIČ">
            <input value={dic} onChange={(e) => setDic(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <button
          type="button"
          onClick={loadFromAres}
          disabled={aresBusy || ic.replace(/\D/g, '').length !== 8}
          title="Doplnit název, DIČ a adresu z veřejného registru podle IČ"
          className="bg-white border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-field transition-colors disabled:opacity-40 mb-[26px]"
        >
          {aresBusy ? 'Načítám…' : 'Načíst z registru'}
        </button>
      </div>

      {aresNote && <p className="text-sm text-brand-greenDeep m-0">{aresNote}</p>}

      <AdminField label="Název firmy" required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        Plátce DPH
      </label>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-[2] min-w-[220px]">
          <AdminField label="Ulice a číslo popisné">
            <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[120px]">
          <AdminField label="PSČ">
            <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label="Město">
            <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label="Země">
            <CountrySelect value={addressCountry} onChange={setAddressCountry} />
          </AdminField>
        </div>
      </div>

      <AdminField label="Číslo účtu">
        <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="admin-input" />
      </AdminField>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Kontaktní osoba">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="E-mail">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Telefon">
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {type === 'KLIENT' && (
        <>
          <AdminField label="Druh zakázek" hint="podle toho klient uvidí jen příslušný typ objednávky">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm font-heading text-ink">
                <input type="checkbox" checked={dealsAudiobooks} onChange={(e) => setDealsAudiobooks(e.target.checked)} />
                Audioknihy
              </label>
              <label className="flex items-center gap-2 text-sm font-heading text-ink">
                <input type="checkbox" checked={dealsAds} onChange={(e) => setDealsAds(e.target.checked)} />
                Reklamy
              </label>
            </div>
          </AdminField>

          {/* Sazba za normostranu dava smysl jen u audioknih - u reklamnich
              klientu se cena pocita z Ceniku. */}
          {dealsAudiobooks && (
            <AdminField label="Sazba za normostranu (Kč bez DPH)" required>
              <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
            </AdminField>
          )}

          <AdminField label="ID firmy v Caflou" hint="podle tohoto ID se z Caflou tahají projekty této firmy - lze doplnit i později">
            <input value={caflouCompanyId} onChange={(e) => setCaflouCompanyId(e.target.value)} placeholder="např. 12345" className="admin-input" />
          </AdminField>

          <AdminField label="Odkaz na složku Google Disk">
            <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" className="admin-input" />
          </AdminField>
        </>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <AddButton type="submit" disabled={saving}>
          {saving ? 'Ukládám…' : 'Uložit firmu'}
        </AddButton>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zrušit
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
