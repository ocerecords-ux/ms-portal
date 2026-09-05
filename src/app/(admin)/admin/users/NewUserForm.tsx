'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { AdminField } from '../NewCompanyForm';
import { ROLE_GROUPS, ROLE_LABELS, roleRequiresCompany, HEREC_STUDIOS } from '@/lib/roles';

const INTERNAL_ROLES: Role[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

// Uzivatele se zakladaji tady, na urovni celeho admin panelu, a paruji se s
// firmou vyberem ze seznamu (misto zakladani primo z detailu jedne firmy) -
// diky tomu je videt vsechny ucty na jednom miste vcetne internich.
//
// Formular jde od 5. 9. 2026 (upresneni) jako multipart/form-data, protoze
// Mediaspace ucty maji volitelnou fotku (soubor) - viz /api/admin/users.
export function NewUserForm({
  companies,
  defaultCompanyId,
  defaultRole,
}: {
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
  defaultRole?: Role;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(defaultRole || 'CLIENT');
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const [caflouTag, setCaflouTag] = useState('');

  // Mediaspace
  const [birthDate, setBirthDate] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  // Herec
  const [studioLocations, setStudioLocations] = useState<string[]>([]);
  const [birthNumber, setBirthNumber] = useState('');
  const [ic, setIc] = useState('');
  const [dic, setDic] = useState('');
  const [vatPayer, setVatPayer] = useState(false);
  const [bankAccount, setBankAccount] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressCountry, setAddressCountry] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsCompany = roleRequiresCompany(role);
  const isMediaspace = INTERNAL_ROLES.includes(role);
  const isHerec = role === 'HEREC';
  // Stitek v Caflou je od 8. 9. 2026 jen a pouze u Klientu (zadani).
  const isClient = role === 'CLIENT';

  function toggleStudio(studio: string) {
    setStudioLocations((prev) => (prev.includes(studio) ? prev.filter((s) => s !== studio) : [...prev, studio]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set('email', email);
      fd.set('name', name);
      fd.set('phone', phone);
      fd.set('password', password);
      fd.set('role', role);
      fd.set('companyId', needsCompany ? companyId : '');
      if (isClient) fd.set('caflouTag', caflouTag);
      if (isMediaspace) {
        fd.set('birthDate', birthDate);
        if (photo) fd.set('photo', photo);
      }
      if (isHerec) {
        studioLocations.forEach((s) => fd.append('studioLocations', s));
        fd.set('birthNumber', birthNumber);
        fd.set('ic', ic);
        fd.set('dic', dic);
        fd.set('vatPayer', String(vatPayer));
        fd.set('bankAccount', bankAccount);
        fd.set('addressStreet', addressStreet);
        fd.set('addressCity', addressCity);
        fd.set('addressZip', addressZip);
        fd.set('addressCountry', addressCountry);
      }

      const res = await fetch('/api/admin/users', { method: 'POST', body: fd });
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
      setBirthDate('');
      setPhoto(null);
      setStudioLocations([]);
      setBirthNumber('');
      setIc('');
      setDic('');
      setVatPayer(false);
      setBankAccount('');
      setAddressStreet('');
      setAddressCity('');
      setAddressZip('');
      setAddressCountry('');
      setRole(defaultRole || 'CLIENT');
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
        {needsCompany && (
          <div className="flex-1 min-w-[200px]">
            <AdminField label="Firma" required>
              <select required value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="admin-input">
                <option value="">— vyberte firmu —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>
        )}
      </div>

      {isMediaspace && (
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[160px]">
            <AdminField label="Datum narození">
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="admin-input" />
            </AdminField>
          </div>
          <div className="flex-1 min-w-[200px]">
            <AdminField label="Fotka">
              <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="admin-input" />
            </AdminField>
          </div>
        </div>
      )}

      {isHerec && (
        <>
          <AdminField label="Lokace" hint="studia, ve kterých je herec schopen fyzicky natáčet">
            <div className="flex flex-col gap-1.5">
              {HEREC_STUDIOS.map((studio) => (
                <label key={studio} className="flex items-center gap-2 text-sm font-heading text-ink">
                  <input type="checkbox" checked={studioLocations.includes(studio)} onChange={() => toggleStudio(studio)} />
                  {studio}
                </label>
              ))}
            </div>
          </AdminField>

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <AdminField label="RČ / datum narození">
                <input value={birthNumber} onChange={(e) => setBirthNumber(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
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

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <AdminField label="Číslo účtu">
                <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex-[2] min-w-[220px]">
              <AdminField label="Ulice č.p.">
                <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <AdminField label="Město">
                <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
            <div className="flex-1 min-w-[120px]">
              <AdminField label="PSČ">
                <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
            <div className="flex-1 min-w-[140px]">
              <AdminField label="Země">
                <input value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} className="admin-input" />
              </AdminField>
            </div>
          </div>
        </>
      )}

      {isClient && (
        <AdminField label="Štítek v Caflou" hint="nepovinné - identifikuje tuto konkrétní osobu v Caflou">
          <input value={caflouTag} onChange={(e) => setCaflouTag(e.target.value)} className="admin-input" />
        </AdminField>
      )}

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
