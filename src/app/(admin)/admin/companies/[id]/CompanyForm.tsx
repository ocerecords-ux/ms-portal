'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminField } from '../../NewCompanyForm';
import type { Company } from '@prisma/client';

export function CompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [rate, setRate] = useState(String(company.ratePerPage));
  const [caflouTag, setCaflouTag] = useState(company.caflouTag ?? '');
  const [driveUrl, setDriveUrl] = useState(company.driveFolderUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ratePerPage: rate, caflouTag, driveFolderUrl: driveUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Uložení se nezdařilo.');
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
      <AdminField label="Název firmy" required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      <AdminField label="Sazba za normostranu (Kč)" required>
        <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
      </AdminField>

      <AdminField label="Štítek klienta v Caflou" hint="přesný název štítku, kterým jsou v Caflou označeny projekty této firmy">
        <input value={caflouTag} onChange={(e) => setCaflouTag(e.target.value)} className="admin-input" />
      </AdminField>

      <AdminField label="Odkaz na složku Google Disk">
        <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" className="admin-input" />
      </AdminField>

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
