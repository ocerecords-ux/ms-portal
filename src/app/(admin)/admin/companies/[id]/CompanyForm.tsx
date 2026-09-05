'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminField } from '../../NewCompanyForm';
import type { Company } from '@prisma/client';
import { COMPANY_TYPE_LABELS } from '@/lib/roles';

export function CompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const [name, setName] = useState(company.name);

  // Klient
  const [rate, setRate] = useState(String(company.ratePerPage ?? ''));
  const [caflouCompanyId, setCaflouCompanyId] = useState(company.caflouCompanyId ?? '');
  const [driveUrl, setDriveUrl] = useState(company.driveFolderUrl ?? '');

  // Dodavatel
  const [contactName, setContactName] = useState(company.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(company.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(company.contactPhone ?? '');
  const [ic, setIc] = useState(company.ic ?? '');
  const [dic, setDic] = useState(company.dic ?? '');
  const [vatPayer, setVatPayer] = useState(company.vatPayer);
  const [bankAccount, setBankAccount] = useState(company.bankAccount ?? '');
  const [address, setAddress] = useState(company.address ?? '');

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const body =
        company.type === 'KLIENT'
          ? { type: 'KLIENT', name, ratePerPage: rate, caflouCompanyId, driveFolderUrl: driveUrl }
          : { type: 'DODAVATEL', name, contactName, contactEmail, contactPhone, ic, dic, vatPayer, bankAccount, address };

      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Uložení se nezdařilo.');
      }
      setSaved(true);
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

      {company.type === 'KLIENT' ? (
        <>
          <AdminField label="Sazba za normostranu (Kč)" required>
            <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
          </AdminField>

          <AdminField label="ID firmy v Caflou" hint="podle tohoto ID se z Caflou tahají projekty této firmy do sekce Projekty">
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
          {saving ? 'Ukládám…' : 'Uložit změny'}
        </button>
        {saved && <span className="text-status-done text-sm font-heading">✓ Uloženo</span>}
      </div>
    </form>
  );
}
