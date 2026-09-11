'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SmazatSPrekazkami } from '@/components/SmazatSPrekazkami';
import type { Role } from '@prisma/client';
import { AdminField } from '../../NewCompanyForm';
import { PhotoDropzone } from '../PhotoDropzone';
import { ROLE_GROUPS, ROLE_LABELS, USER_TABS, roleRequiresCompany } from '@/lib/roles';
import { LOKACE_S_BARVOU } from '@/lib/lokaceHercu';

const INTERNAL_ROLES: Role[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

type EditableUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  companyId: string | null;
  active: boolean;
  birthDate: string | null;
  photoUrl: string | null;
  hourlyRate: number | null;
  /** Smí být manažerem projektu (zadání 10. 9. 2026). */
  manazerProjektu: boolean;
  prijimaDotazyKlientu: boolean;
  dostavaDotoceno: boolean;
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
  const [hourlyRate, setHourlyRate] = useState(String(user.hourlyRate ?? ''));
  const [manazerProjektu, setManazerProjektu] = useState(user.manazerProjektu);
  const [prijimaDotazy, setPrijimaDotazy] = useState(user.prijimaDotazyKlientu);
  const [dostavaDotoceno, setDostavaDotoceno] = useState(user.dostavaDotoceno);
  const [companyId, setCompanyId] = useState(user.companyId ?? '');
  const [active, setActive] = useState(user.active);
  // Tvrde smazani (zadani 10. 9. 2026) - jen kdyz na uctu nic nevisi.
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
      fd.set('active', String(active));
      if (newPassword) fd.set('password', newPassword);
      if (isMediaspace) {
        fd.set('birthDate', birthDate);
        if (role === 'ZVUKAR') fd.set('hourlyRate', hourlyRate);
        if (isMediaspace) fd.set('manazerProjektu', manazerProjektu ? '1' : '0');
        if (isMediaspace) fd.set('prijimaDotazyKlientu', prijimaDotazy ? '1' : '0');
        if (isMediaspace) fd.set('dostavaDotoceno', dostavaDotoceno ? '1' : '0');
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
      // Po ulozeni zpatky do seznamu, na zalozku podle role uctu (zadani
      // 10. 9. 2026: "kdyz zedituju herce a dam ulozit, at se vratim na kartu
      // Herci"). Bere se role PO uprave - kdyz se prave zmenila, patri ucet
      // uz jinam a vracet se na puvodni zalozku by matlo.
      router.refresh();
      router.push(`/admin/users?tab=${zalozkaProRoli(role)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-card p-6 flex flex-col gap-4">
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
        {/* Hodinova sazba - jen zvukar, pocitaji se z ni vykazy prace
            (zadani 6. 9. 2026). */}
        {role === 'ZVUKAR' && (
          <div className="flex-1 min-w-[180px]">
            <AdminField label="Hodinová sazba (Kč)" hint="z ní se počítají výkazy práce">
              <input
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="250"
                className="admin-input"
              />
            </AdminField>
          </div>
        )}
        {/* Kdo se nabizi jako manazer projektu (zadani 10. 9. 2026). */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={manazerProjektu}
                onChange={(e) => setManazerProjektu(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Může být manažer projektu
                <span className="block text-xs text-muted">nabízí se u projektů ve výběru manažera</span>
              </span>
            </label>
          </div>
        )}
        {/* Kdo sedi v kanalech, ktere klient otevre tlacitkem "Zeptat se"
            u sveho projektu (zadani 11. 9. 2026). */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={prijimaDotazy}
                onChange={(e) => setPrijimaDotazy(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Dostává dotazy klientů
                <span className="block text-xs text-muted">
                  je v každém kanálu, který klient otevře tlačítkem Zeptat se
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Zprava o dotocenem herci (zadani 11. 9. 2026: "info o dotoceno
            s hercem jde notifikaci mailem na Helenu Rychlik"). Priznak
            u uctu, ne adresa v kodu - az to bude hlidat nekdo jiny,
            preklikne se to tady. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dostavaDotoceno}
                onChange={(e) => setDostavaDotoceno(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Dostává zprávy o dotočení
                <span className="block text-xs text-muted">
                  mail pokaždé, když se u projektu odškrtne dotočený herec
                </span>
              </span>
            </label>
          </div>
        )}

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
            {/* Barva u kazde lokace je stejna jako v seznamu hercu (zadani
                10. 9. 2026) - kdo si ji zapamatuje tady, precte pak seznam
                bez cteni textu. Brno I a Brno II sdileji barvu: jsou to dve
                mistnosti v jednom meste. */}
            <div className="flex flex-col gap-1.5">
              {LOKACE_S_BARVOU.map((studio) => (
                <label
                  key={studio.nazev}
                  className="flex items-center gap-2 text-sm font-heading text-ink cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={studioLocations.includes(studio.nazev)}
                    onChange={() => toggleStudio(studio.nazev)}
                  />
                  <span
                    className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-heading font-semibold ${studio.barva}`}
                  >
                    {studio.popisek}
                  </span>
                  <span className="text-muted text-xs font-body">{studio.nazev}</span>
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

      {/* Vyrazeni misto mazani (zadani 10. 9. 2026): na uzivateli visi smlouvy,
          vykazy a projekty, ktere musi zustat citelne. Drive to byla jen
          nenapadna zaskrtavaci polozka, takze nikdo netusil, ze tudy vede
          cesta, kdyz je potreba nekoho "smazat". */}
      <div className="border-t border-line pt-4 flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <p className="font-heading font-semibold text-sm text-ink m-0">
            {active ? 'Vyřadit uživatele' : 'Uživatel je vyřazený'}
          </p>
          <p className="text-xs font-body text-muted m-0 mt-1">
            {active
              ? 'Nepřihlásí se a zmizí z nabídek. Smlouvy, výkazy a projekty, které na něj odkazují, zůstanou beze změny — proto se nemaže. Změna se uloží tlačítkem níž.'
              : 'Nemůže se přihlásit a nenabízí se u projektů. Vrátit ho jde kdykoliv. Změna se uloží tlačítkem níž.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActive(!active)}
          className={`font-heading font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors ${
            active
              ? 'border border-line text-danger hover:bg-dangerTint'
              : 'bg-brand-green text-onAccent hover:brightness-95'
          }`}
        >
          {active ? 'Vyřadit uživatele' : 'Vrátit mezi aktivní'}
        </button>
      </div>

      {/* Tvrde smazani (zadani 10. 9. 2026). Kdyz na uctu neco visi, portal
          nabidne archivaci - viz SmazatSPrekazkami. */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-heading font-semibold text-sm text-ink m-0">Smazat účet úplně</p>
          <p className="text-xs font-body text-muted m-0 mt-1">
            Když na účtu nic nevisí, smaže se rovnou. Když něco visí, portál nejdřív ukáže co
            a nabídne archivaci. Projekty tím nezanikají — účet u nich jen přestane být vyplněný.
          </p>
        </div>
        <SmazatSPrekazkami
          url={`/api/admin/users/${user.id}`}
          co={`Účet ${user.name || user.email}`}
          popisek="Smazat účet"
          onSmazano={() => {
            router.push('/admin/users');
            router.refresh();
          }}
        />
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

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

/** Na kterou záložku seznamu účet patří - podle role. */
function zalozkaProRoli(role: Role): string {
  return USER_TABS.find((t) => t.roles.includes(role))?.key ?? USER_TABS[0].key;
}
