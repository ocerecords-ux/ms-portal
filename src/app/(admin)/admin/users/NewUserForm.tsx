'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { AdminField } from '../NewCompanyForm';
import { ROLE_GROUPS, ROLE_LABELS, roleRequiresCompany } from '@/lib/roles';

// Uzivatele se zakladaji tady, na urovni celeho admin panelu, a paruji se s
// firmou vyberem ze seznamu (misto zakladani primo z detailu jedne firmy) -
// diky tomu je videt vsechny ucty na jednom miste vcetne internich.
export function NewUserForm({
  companies,
  defaultCompanyId,
}: {
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CLIENT');
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const [caflouTag, setCaflouTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsCompany = roleRequiresCompany(role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          phone,
          password,
          role,
          companyId: needsCompany ? companyId : null,
          caflouTag,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Účet se nepodařilo založit.');
      }
      setCreated(`Účet ${email} je založen. Přihlašovací heslo mu prosím předejte bezpečnou cestou.`);
      setEmail('');
      setName('');
      setPhone('');
      setPassword('');
      setCaflouTag('');
      setRole('CLIENT');
      setCompanyId(defaultCompanyId || '');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Účet se nepodařilo založit.');
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
        + Přidat uživatele
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4 max-w-2xl">
      <h2 className="font-display text-xl text-ink m-0">Nový uživatel</h2>

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
          <AdminField label="Telefon">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Počáteční heslo" required hint="uživatel si ho může později změnit">
            <input
              required
              type="text"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
            />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[200px]">
          <AdminField label="Role" required>
            <select required value={role} onChange={(e) => setRole(e.target.value as Role)} className="admin-input">
              {ROLE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </AdminField>
        </div>
        <div className="flex-1 min-w-[200px]">
          <AdminField label="Firma" required={needsCompany} hint={needsCompany ? undefined : 'interní role - firma se nepáruje'}>
            <select
              required={needsCompany}
              disabled={!needsCompany}
              value={needsCompany ? companyId : ''}
              onChange={(e) => setCompanyId(e.target.value)}
              className="admin-input"
            >
              <option value="">— vyberte firmu —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </AdminField>
        </div>
      </div>

      <AdminField label="Štítek v Caflou" hint="nepovinné - identifikuje tuto konkrétní osobu v Caflou">
        <input value={caflouTag} onChange={(e) => setCaflouTag(e.target.value)} className="admin-input" />
      </AdminField>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {created && <p className="text-status-done text-sm">{created}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Zakládám…' : 'Uložit uživatele'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zrušit
        </button>
      </div>
    </form>
  );
}
