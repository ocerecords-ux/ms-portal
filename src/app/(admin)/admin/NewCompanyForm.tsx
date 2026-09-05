'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanyType } from '@prisma/client';

// Firmy se od 5. 9. 2026 deli na Klienty a Dodavatele (CompanyType) - typ se
// prednastavi podle zalozky, na ktere admin prave je (viz page.tsx), pole
// formulare se pak podle typu lisi (viz schema.prisma > model Company).
export function NewCompanyForm({ defaultType }: { defaultType: CompanyType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CompanyType>(defaultType);
  const [name, setName] = useState('');

  // Klient
  const [rate, setRate] = useState('');
  const [caflouCompanyId, setCaflouCompanyId] = useState('');
  const [driveUrl, setDriveUrl] = useState('');

  // Dodavatel
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [ic, setIc] = useState('');
  const [dic, setDic] = useState('');
  const [vatPayer, setVatPayer] = useState(false);
  const [bankAccount, setBankAccount] = useState('');
  const [address, setAddress] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetFields() {
    setName('');
    setRate('');
    setCaflouCompanyId('');
    setDriveUrl('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setIc('');
    setDic('');
    setVatPayer(false);
    setBankAccount('');
    setAddress('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body =
        type === 'KLIENT'
          ? { type, name, ratePerPage: rate, caflouCompanyId, driveFolderUrl: driveUrl }
          : { type, name, contactName, contactEmail, contactPhone, ic, dic, vatPayer, bankAccount, address };

      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Firmu se nepodařilo založit.');
      }
      resetFields();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firmu se nepodařilo založit.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors self-start"
      >
        {defaultType === 'KLIENT' ? '+ Nový klient' : '+ Nový dodavatel'}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4 max-w-lg">
      <h2 className="font-display text-xl text-ink m-0">{type === 'KLIENT' ? 'Nový klient' : 'Nový dodavatel'}</h2>

      <AdminField label="Typ firmy" required>
        <select value={type} onChange={(e) => setType(e.target.value as CompanyType)} className="admin-input">
          <option value="KLIENT">Klient</option>
          <option value="DODAVATEL">Dodavatel</option>
        </select>
      </AdminField>

      <AdminField label="Název firmy" required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      {type === 'KLIENT' ? (
        <>
          <AdminField label="Sazba za normostranu (Kč)" required>
            <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
          </AdminField>

          <AdminField label="ID firmy v Caflou" hint="podle tohoto ID se z Caflou tahají projekty této firmy - lze doplnit i později">
            <input value={caflouCompanyId} onChange={(e) => setCaflouCompanyId(e.target.value)} placeholder="např. 12345" className="admin-input" />
          </AdminField>

          <AdminField label="Odkaz na složku Google Disk">
            <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" className="admin-input" />
          </AdminField>
        </>
      ) : (
        <>
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

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <AdminField label="IČ">
                <input value={ic} onChange={(e) => setIc(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
            <div className="flex-1 min-w-[140px]">
              <AdminField label="DIČ">
                <input value={dic} onChange={(e) => setDic(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-heading text-ink">
            <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
            Plátce DPH
          </label>

          <AdminField label="Číslo účtu">
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="admin-input" />
          </AdminField>

          <AdminField label="Adresa">
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="admin-input" />
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
          {saving ? 'Ukládám…' : 'Uložit firmu'}
        </button>
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
