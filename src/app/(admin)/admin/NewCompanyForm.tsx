'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewCompanyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [caflouTag, setCaflouTag] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ratePerPage: rate, caflouTag, driveFolderUrl: driveUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Firmu se nepodařilo založit.');
      }
      setName('');
      setRate('');
      setCaflouTag('');
      setDriveUrl('');
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
        className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors"
      >
        + Nová firma
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4 max-w-lg">
      <h2 className="font-display text-xl text-ink m-0">Nová firma</h2>

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
          {saving ? 'Ukládám…' : 'Uložit firmu'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zrušit
        </button>
      </div>

      <style jsx global>{`
        .admin-input {
          font-family: var(--font-inter);
          font-size: 14px;
          border-radius: 8px;
          border: 1.5px solid #e4dffb;
          padding: 9px 12px;
          background: #fff;
          color: #201a33;
          width: 100%;
        }
        .admin-input:focus {
          outline: none;
          border-color: #7b55ff;
          box-shadow: 0 0 0 3px rgba(123, 85, 255, 0.15);
        }
      `}</style>
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
