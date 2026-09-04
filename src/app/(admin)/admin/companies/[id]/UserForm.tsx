'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminField } from '../../NewCompanyForm';

export function UserForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [caflouTag, setCaflouTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, companyId, role: 'CLIENT', caflouTag }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Účet se nepodařilo založit.');
      }
      setCreated(`Účet ${email} je založen. Přihlašovací heslo mu prosím předejte bezpečnou cestou.`);
      setEmail('');
      setName('');
      setPassword('');
      setCaflouTag('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Účet se nepodařilo založit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4">
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <AdminField label="E-mail" required>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Jméno">
            <input value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Počáteční heslo" required hint="klient si ho může později změnit">
            <input required type="text" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Štítek v Caflou" hint="nepovinné - identifikuje tuto konkrétní osobu v Caflou">
            <input value={caflouTag} onChange={(e) => setCaflouTag(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {created && <p className="text-status-done text-sm">{created}</p>}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Zakládám…' : '+ Založit přihlašovací účet'}
        </button>
      </div>
    </form>
  );
}
