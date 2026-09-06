'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminField } from '../../NewCompanyForm';
import { CountrySelect } from '../../CountrySelect';
import type { Company } from '@prisma/client';
import { COMPANY_TYPE_LABELS } from '@/lib/roles';
import { DEFAULT_COUNTRY } from '@/lib/countries';

/**
 * Karta firmy (zadani 6. 9. 2026). Fakturacni udaje - IC, DIC, platce DPH,
 * adresa po castech a splatnost - vedeme nove u OBOU typu firem, drive je mel
 * jen dodavatel. Sazba za normostranu se ukazuje jen u klienta, ktery ma
 * zaskrtnute Audioknihy (u reklamnich klientu se bude pocitat z Ceniku).
 */
export function CompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const isClient = company.type === 'KLIENT';

  const [name, setName] = useState(company.name);
  const [ic, setIc] = useState(company.ic ?? '');
  const [dic, setDic] = useState(company.dic ?? '');
  const [vatPayer, setVatPayer] = useState(company.vatPayer);
  const [bankAccount, setBankAccount] = useState(company.bankAccount ?? '');
  const [addressStreet, setAddressStreet] = useState(company.addressStreet ?? company.address ?? '');
  const [addressCity, setAddressCity] = useState(company.addressCity ?? '');
  const [addressZip, setAddressZip] = useState(company.addressZip ?? '');
  const [addressCountry, setAddressCountry] = useState(company.addressCountry ?? DEFAULT_COUNTRY);
  const [paymentTermDays, setPaymentTermDays] = useState(String(company.paymentTermDays ?? ''));

  const [contactName, setContactName] = useState(company.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(company.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(company.contactPhone ?? '');

  const [rate, setRate] = useState(String(company.ratePerPage ?? ''));
  const [caflouCompanyId, setCaflouCompanyId] = useState(company.caflouCompanyId ?? '');
  const [driveUrl, setDriveUrl] = useState(company.driveFolderUrl ?? '');
  const [dealsAudiobooks, setDealsAudiobooks] = useState(company.dealsAudiobooks);
  const [dealsAds, setDealsAds] = useState(company.dealsAds);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aresBusy, setAresBusy] = useState(false);
  const [aresNote, setAresNote] = useState<string | null>(null);

  /** Nacteni udaju z ARES podle IC (zadani 6. 9. 2026). */
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
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: company.type,
          name,
          ic,
          dic,
          vatPayer,
          bankAccount,
          addressStreet,
          addressCity,
          addressZip,
          addressCountry,
          paymentTermDays,
          contactName,
          contactEmail,
          contactPhone,
          ...(isClient
            ? { ratePerPage: dealsAudiobooks ? rate : '', caflouCompanyId, driveFolderUrl: driveUrl, dealsAudiobooks, dealsAds }
            : {}),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Uložení se nezdařilo.');
      }
      setSaved(true);
      setAresNote(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4">
      <p className="text-xs font-heading text-muted uppercase tracking-wide -mb-1">
        Typ firmy: <span className="text-ink">{COMPANY_TYPE_LABELS[company.type]}</span>
      </p>

      <AdminField label="Název firmy" required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      <div className="flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[140px]">
          <AdminField label="IČ">
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
          className="bg-white border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-field transition-colors disabled:opacity-40 mb-[2px]"
        >
          {aresBusy ? 'Načítám…' : 'Načíst z registru'}
        </button>
      </div>

      {aresNote && <p className="text-sm text-brand-greenDeep m-0">{aresNote}</p>}

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

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label="Číslo účtu">
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label="Doba splatnosti (dny)" hint="předvyplní se při vystavování faktury">
            <input
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(e.target.value)}
              inputMode="numeric"
              placeholder="14"
              className="admin-input"
            />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Kontaktní osoba">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="E-mail" hint="sem chodí nabídky a faktury">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Telefon">
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {isClient && (
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
              klientu se cena bude pocitat kalkulackou nad Cenikem. */}
          {dealsAudiobooks && (
            <AdminField label="Sazba za normostranu (Kč bez DPH)" required>
              <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
            </AdminField>
          )}

          <AdminField label="ID firmy v Caflou" hint="podle tohoto ID se z Caflou tahají projekty této firmy do sekce Projekty">
            <input value={caflouCompanyId} onChange={(e) => setCaflouCompanyId(e.target.value)} placeholder="např. 12345" className="admin-input" />
          </AdminField>

          <AdminField label="Odkaz na složku Google Disk">
            <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" className="admin-input" />
          </AdminField>
        </>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit změny'}
        </button>
        {saved && <span className="text-status-done text-sm font-heading">✓ Uloženo</span>}
      </div>
    </form>
  );
}
