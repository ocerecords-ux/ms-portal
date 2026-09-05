'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { AdminField } from '../../NewCompanyForm';
import { ROLE_GROUPS, ROLE_LABELS, roleRequiresCompany } from '@/lib/roles';

type EditableUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  companyId: string | null;
  caflouTag: string | null;
  active: boolean;
};

// Editace VSECH udaju existujiciho uzivatele (email, jmeno, telefon, role,
// firma, aktivni stav, heslo, stitek v Caflou) - viz zadani 5. 9. 2026:
// "aby sly editovat uzivatele... abych jim mohl zmenit vsechny udaje".
export function UserEditForm({
  user,
  companies,
}: {
  user: EditableUser;
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [companyId, setCompanyId] = useState(user.companyId ?? '');
  const [caflouTag, setCaflouTag] = useState(user.caflouTag ?? '');
  const [active, setActive] = useState(user.active);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsCompany = roleRequiresCompany(role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          phone,
          role,
          companyId: needsCompany ? companyId || null : null,
          caflouTag,
          active,
          ...(newPassword ? { password: newPassword } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Uložení se nezdařilo.');
      }
      setSaved(true);
      setNewPassword('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
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
          <AdminField label="Telefon">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
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
          <AdminField
            label="Firma"
            required={needsCompany}
            hint={needsCompany ? undefined : 'interní role - firma se nepáruje'}
          >
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

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Štítek v Caflou" hint="nepovinné">
            <input value={caflouTag} onChange={(e) => setCaflouTag(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Nové heslo" hint="nechte prázdné, pokud nechcete měnit">
            <input
              type="text"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="admin-input"
            />
          </AdminField>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Aktivní účet (může se přihlásit)
      </label>

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
