'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { AdminField } from '../../NewCompanyForm';
import { PhotoDropzone } from '../PhotoDropzone';
import { ROLE_GROUPS, ROLE_LABELS, roleRequiresCompany, HEREC_STUDIOS } from '@/lib/roles';

const INTERNAL_ROLES: Role[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

type EditableUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  companyId: string | null;
  caflouTag: string | null;
  active: boolean;
  birthDate: string | null;
  photoUrl: string | null;
  studioLocations: string[];
  birthNumber: string | null;
  ic: string | null;
  dic: string | null;
  vatPayer: boolean;
  bankAccount: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
};

// Editace VSECH udaju existujiciho uzivatele (email, jmeno, telefon, role,
// firma, aktivni stav, heslo, stitek v Caflou + pole specificka pro danou
// kategorii - viz zadani 5. 9. 2026). multipart/form-data kvuli volitelne
// fotce u Mediaspace uctu.
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

  // Mediaspace
  const [birthDate, setBirthDate] = useState(user.birthDate ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  // Herec
  const [studioLocations, setStudioLocations] = useState<string[]>(user.studioLocations);
  const [birthNumber, setBirthNumber] = useState(user.birthNumber ?? '');
  const [ic, setIc] = useState(user.ic ?? '');
  const [dic, setDic] = useState(user.dic ?? '');
  const [vatPayer, setVatPayer] = useState(user.vatPayer);
  const [bankAccount, setBankAccount] = useState(user.bankAccount ?? '');
  const [addressStreet, setAddressStreet] = useState(user.addressStreet ?? '');
  const [addressCity, setAddressCity] = useState(user.addressCity ?? '');
  const [addressZip, setAddressZip] = useState(user.addressZip ?? '');
  const [addressCountry, setAddressCountry] = useState(user.addressCountry ?? '');

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set('email', email);
      fd.set('name', name);
      fd.set('phone', phone);
      fd.set('role', role);
      fd.set('companyId', needsCompany ? companyId || '' : '');
      if (isClient) fd.set('caflouTag', caflouTag);
      fd.set('active', String(active));
      if (newPassword) fd.set('password', newPassword);
      if (isMediaspace) {
        fd.set('birthDate', birthDate);
        if (photo) fd.set('photo', photo);
        else if (removePhoto) fd.set('removePhoto', 'true');
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

      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Uložení se nezdařilo.');
      }
      setSaved(true);
      setNewPassword('');
      setPhoto(null);
      setRemovePhoto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4">
      {/* Poradi poli (zadani 12. 9. 2026): Jmeno + Fotka (drag & drop) prvni,
          pak Role (+ Firma), az pak E-mail + Telefon. */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Jméno">
            <input value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        {isMediaspace && (
          <div className="flex-[2] min-w-[240px]">
            <AdminField label="Fotka">
              <PhotoDropzone
                file={photo}
                onChange={(f) => {
                  setPhoto(f);
                  if (f) setRemovePhoto(false);
                }}
                existingUrl={!removePhoto ? user.photoUrl : null}
                onRemoveExisting={() => setRemovePhoto(true)}
              />
            </AdminField>
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <AdminField label="Typ přístupu" required>
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

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <AdminField label="E-mail" required>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label="Telefon">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {isMediaspace && (
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <AdminField label="Datum narození">
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="admin-input" />
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

      <div className="flex gap-4 flex-wrap">
        {isClient && (
          <div className="flex-1 min-w-[160px]">
            <AdminField label="Štítek v Caflou" hint="nepovinné">
              <input value={caflouTag} onChange={(e) => setCaflouTag(e.target.value)} className="admin-input" />
            </AdminField>
          </div>
        )}
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
