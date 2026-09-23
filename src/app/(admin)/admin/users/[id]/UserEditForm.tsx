'use client';

import { useState } from 'react';
import { Volba } from '@/components/Volba';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SmazatSPrekazkami } from '@/components/SmazatSPrekazkami';
import type { Role } from '@prisma/client';
import { AdminField } from '../../NewCompanyForm';
import { CountrySelect } from '../../CountrySelect';
import { kodZeme } from '@/lib/countries';
import { PhotoDropzone } from '../PhotoDropzone';
import { ROLE_GROUPS, ROLE_LABELS, USER_TABS, roleRequiresCompany } from '@/lib/roles';
import { LOKACE_S_BARVOU } from '@/lib/lokaceHercu';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

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
  /** Podepisuje za Mediaspace smlouvy (zadání 15. 9. 2026). */
  smlouvyPodepisuje: boolean;
  prijimaDotazyKlientu: boolean;
  /** Vidí sekci Banka (zadání 17. 9. 2026). */
  vidiBanku: boolean;
  /** Chce vědět o změně stavu a termínů u projektů (zadání 18. 9. 2026). */
  sledujeZmenyProjektu: boolean;
  /** Účet jen na prohlížení portálu z různých rolí (zadání 18. 9. 2026). */
  jenNahled: boolean;
  dostavaDotoceno: boolean;
  /** Zvonek, kdyz klient schvali reklamu (23. 9. 2026). */
  schvaleniReklam: boolean;
  /** Striha externe - v kalendari letadlo, do obsazenosti studia se nepocita. */
  strihaExterne: boolean;
  /** Vidi znacku stavu nabidky u reklam (23. 9. 2026). */
  nabidkyReklam: boolean;
  /** Klient chce vědět o dotočeném herci na svém projektu (zadání 16. 9. 2026). */
  dostavaDotocenoKlient: boolean;
  dostavaObjednavky: boolean;
  takyZvukar: boolean;
  dostavaVyplneneUdaje: boolean;
  vychoziManazerAudioknih: boolean;
  studioLocations: string[];
  /** Studia, ve kterých zvukař točí (zadání 20. 9. 2026). */
  zvukarStudia: string[];
  /** Vedoucí pobočky - smí upravovat kalendář těchto studií (22. 9. 2026). */
  vedeStudia: string[];
  tabulePristup: string[];
  birthNumber: string | null;
  ic: string | null;
  dic: string | null;
  vatPayer: boolean;
  bankAccount: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  /** Firma-dodavatel založená z tohohle herce (zadání 16. 9. 2026). */
  dodavatel: { id: string; name: string; code: string | null } | null;
};

// Editace VSECH udaju existujiciho uzivatele (email, jmeno, telefon, role,
// firma, aktivni stav, heslo, stitek v Caflou + pole specificka pro danou
// kategorii - viz zadani 5. 9. 2026). multipart/form-data kvuli volitelne
// fotce u Mediaspace uctu.
export function UserEditForm({
  user,
  companies,
  studia,
}: {
  user: EditableUser;
  companies: { id: string; name: string }[];
  /** Studia z administrace - z nich jsou zaškrtávátka u zvukaře. */
  studia: { id: string; shortName: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [hourlyRate, setHourlyRate] = useState(String(user.hourlyRate ?? ''));
  const [manazerProjektu, setManazerProjektu] = useState(user.manazerProjektu);
  const [smlouvyPodepisuje, setSmlouvyPodepisuje] = useState(user.smlouvyPodepisuje);
  const [prijimaDotazy, setPrijimaDotazy] = useState(user.prijimaDotazyKlientu);
  const [vidiBanku, setVidiBanku] = useState(user.vidiBanku);
  const [sledujeZmeny, setSledujeZmeny] = useState(user.sledujeZmenyProjektu);
  const [jenNahled, setJenNahled] = useState(user.jenNahled);
  const [dostavaDotoceno, setDostavaDotoceno] = useState(user.dostavaDotoceno);
  const [schvaleniReklam, setSchvaleniReklam] = useState(user.schvaleniReklam);
  const [strihaExterne, setStrihaExterne] = useState(user.strihaExterne);
  const [nabidkyReklam, setNabidkyReklam] = useState(user.nabidkyReklam);
  const [dostavaDotocenoKlient, setDostavaDotocenoKlient] = useState(user.dostavaDotocenoKlient);
  const [dostavaObjednavky, setDostavaObjednavky] = useState(user.dostavaObjednavky);
  const [takyZvukar, setTakyZvukar] = useState(user.takyZvukar);
  const [dostavaVyplneneUdaje, setDostavaVyplneneUdaje] = useState(user.dostavaVyplneneUdaje);
  const [vychoziManazerAudioknih, setVychoziManazerAudioknih] = useState(user.vychoziManazerAudioknih);
  const [companyId, setCompanyId] = useState(user.companyId ?? '');
  const [active, setActive] = useState(user.active);
  // Tvrde smazani (zadani 10. 9. 2026) - jen kdyz na uctu nic nevisi.
  const [newPassword, setNewPassword] = useState('');

  // Mediaspace
  const [birthDate, setBirthDate] = useState(user.birthDate ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  // Zvukař - ve kterých studiích točí (zadání 20. 9. 2026)
  const [zvukarStudia, setZvukarStudia] = useState<string[]>(user.zvukarStudia);
  const [vedeStudia, setVedeStudia] = useState<string[]>(user.vedeStudia);
  const [tabulePristup, setTabulePristup] = useState<string[]>(user.tabulePristup);

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
  // Ve starých záznamech je země napsaná slovem; nabídka chce kód.
  const [addressCountry, setAddressCountry] = useState(kodZeme(user.addressCountry));

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * HEREC, KTERÝ JE ZÁROVEŇ DODAVATEL (zadání 16. 9. 2026). Založí z jeho
   * karty firmu typu Dodavatel; hercem zůstává. Viz
   * /api/admin/users/[id]/dodavatel.
   */
  const [dodavatel, setDodavatel] = useState(user.dodavatel);
  const [prenaseni, setPrenaseni] = useState(false);

  async function prenesDoDodavatelu() {
    setPrenaseni(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/dodavatel`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string })?.error || 'Přenos do dodavatelů se nezdařil.');
        return;
      }
      setDodavatel((data as { firma?: typeof dodavatel })?.firma ?? null);
      router.refresh();
    } catch {
      setError('Přenos do dodavatelů se nezdařil.');
    } finally {
      setPrenaseni(false);
    }
  }

  const needsCompany = roleRequiresCompany(role);
  const isMediaspace = INTERNAL_ROLES.includes(role);
  const isHerec = role === 'HEREC';
  const isZvukar = role === 'ZVUKAR';
  const isKlient = role === 'CLIENT';

  /** Zaškrtnutí studia u zvukaře. */
  function prepniStudioZvukare(id: string) {
    setZvukarStudia((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

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
      // Nahledovy ucet (zadani 18. 9. 2026) - jde nastavit u kazde role, proto
      // mimo vetve podle role nize.
      fd.set('jenNahled', jenNahled ? '1' : '0');
      if (newPassword) fd.set('password', newPassword);
      if (isMediaspace) {
        fd.set('birthDate', birthDate);
        if (role === 'ZVUKAR') fd.set('hourlyRate', hourlyRate);
        if (isMediaspace) fd.set('manazerProjektu', manazerProjektu ? '1' : '0');
        if (isMediaspace) fd.set('smlouvyPodepisuje', smlouvyPodepisuje ? '1' : '0');
        if (isMediaspace) fd.set('prijimaDotazyKlientu', prijimaDotazy ? '1' : '0');
        if (isMediaspace) fd.set('vidiBanku', vidiBanku ? '1' : '0');
        if (isMediaspace) fd.set('sledujeZmenyProjektu', sledujeZmeny ? '1' : '0');
        if (isMediaspace) fd.set('dostavaDotoceno', dostavaDotoceno ? '1' : '0');
        if (isMediaspace) fd.set('schvaleniReklam', schvaleniReklam ? '1' : '0');
        if (isMediaspace) fd.set('strihaExterne', strihaExterne ? '1' : '0');
        if (isMediaspace) fd.set('nabidkyReklam', nabidkyReklam ? '1' : '0');
        if (isMediaspace) fd.set('dostavaObjednavky', dostavaObjednavky ? '1' : '0');
        if (isMediaspace && role !== 'ZVUKAR') fd.set('takyZvukar', takyZvukar ? '1' : '0');
        // Přístup na tabule (23. 9. 2026) - prázdný seznam se musí poslat taky.
        fd.set('tabulePristupPrazdne', '1');
        tabulePristup.forEach((id) => fd.append('tabulePristup', id));
        if (isMediaspace) fd.set('dostavaVyplneneUdaje', dostavaVyplneneUdaje ? '1' : '0');
        if (isMediaspace) {
          fd.set('vychoziManazerAudioknih', vychoziManazerAudioknih ? '1' : '0');
        }
        if (photo) fd.set('photo', photo);
        else if (removePhoto) fd.set('removePhoto', 'true');
      }
      if (isKlient) fd.set('dostavaDotocenoKlient', dostavaDotocenoKlient ? '1' : '0');
      if (isZvukar) {
        fd.set('vedeStudiaPrazdne', '1');
        vedeStudia.forEach((id) => fd.append('vedeStudia', id));
        // Prázdný seznam se musí poslat taky - jinak by odškrtnutí posledního
        // studia server nepoznal od „tohle pole neposílám".
        fd.set('zvukarStudiaPrazdne', '1');
        zvukarStudia.forEach((id) => fd.append('zvukarStudia', id));
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
            <VyberPole required value={role} onChange={(e) => setRole(e.target.value as Role)} className="admin-input">
              {ROLE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </VyberPole>
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
        {/* LOKALIZACE ZVUKAŘŮ (zadání 20. 9. 2026: „ještě pojďme udělat
            lokalizace zvukařů ... uděl[ej] asi ze zvukařů v uživatelích
            zaškrtávátka"). Zaškrtávátka jsou ze skutečných studií, takže se
            nově přidané studio objeví samo. Brno I a Brno II jsou dvě
            místnosti - kdo točí v obou, má zaškrtnuté obě. */}
        {isZvukar && (
          <div className="w-full">
            <AdminField label="Studia" hint="ve kterých studiích zvukař točí">
              <div className="flex flex-wrap gap-2">
                {studia.map((studio) => (
                  <Volba
                    key={studio.id}
                    vybrano={zvukarStudia.includes(studio.id)}
                    onZmena={() => prepniStudioZvukare(studio.id)}
                    title={studio.name}
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm font-body text-ink">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: studio.color }}
                        aria-hidden
                      />
                      {studio.shortName}
                    </span>
                  </Volba>
                ))}
                {studia.length === 0 && (
                  <span className="text-sm font-body text-muted">
                    Zatím tu není žádné studio - založte ho v Administraci → Studia.
                  </span>
                )}
              </div>
            </AdminField>
            {/* VEDOUCÍ POBOČKY (zadání 22. 9. 2026: „Tomáš Ilavský by měl mít
                přístup k úpravám i brněnských kalendářů. Je to vedoucí
                pobočky"). V zaškrtnutých studiích upravuje kalendář jako
                produkce. */}
            <div className="mt-3">
              <AdminField label="Vedoucí pobočky" hint="v těchto studiích smí zapisovat, posouvat a mazat události v kalendáři">
                <div className="flex flex-wrap gap-2">
                  {studia.map((studio) => (
                    <Volba
                      key={studio.id}
                      vybrano={vedeStudia.includes(studio.id)}
                      onZmena={() =>
                        setVedeStudia((p) => (p.includes(studio.id) ? p.filter((x) => x !== studio.id) : [...p, studio.id]))
                      }
                      title={studio.name}
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-body text-ink">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: studio.color }} aria-hidden />
                        {studio.shortName}
                      </span>
                    </Volba>
                  ))}
                </div>
              </AdminField>
            </div>
          </div>
        )}
        {/* PŘÍSTUP NA TABULE (zadání 23. 9. 2026: „dej přístup na brněnské
            tabule Tomáši Ilavskému a celému Žůžo-labůžo. A pak v Praze Ondřej
            Černý ml."). Kdo má studio zaškrtnuté, otevře si jeho tabuli pod
            svým účtem - adresu ani účet tabule k tomu nepotřebuje. */}
        {isMediaspace && (
          <div className="w-full">
            <AdminField label="Přístup na tabule" hint="tyhle tabule si otevře pod svým účtem v Můj účet → Tabule ve studiu">
              <div className="flex flex-wrap gap-2">
                {studia.map((studio) => (
                  <Volba
                    key={studio.id}
                    vybrano={tabulePristup.includes(studio.id)}
                    onZmena={() =>
                      setTabulePristup((p) =>
                        p.includes(studio.id) ? p.filter((x) => x !== studio.id) : [...p, studio.id],
                      )
                    }
                    title={studio.name}
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm font-body text-ink">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: studio.color }} aria-hidden />
                      {studio.shortName}
                    </span>
                  </Volba>
                ))}
                {studia.length === 0 && (
                  <span className="text-sm font-body text-muted">Zatím tu není žádné studio.</span>
                )}
              </div>
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
        {/* Kdo za Mediaspace podepisuje smlouvy (zadani 15. 9. 2026). Jeho
            podpis se ke smlouve pripoji sam pri odeslani k podpisu. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={smlouvyPodepisuje}
                onChange={(e) => setSmlouvyPodepisuje(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Podepisuje smlouvy za Mediaspace
                <span className="block text-xs text-muted">
                  odeslaná smlouva je od nás rovnou podepsaná jeho jménem
                </span>
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

        {/* Kdo vidi sekci Banka - napojeni uctu a parovani plateb
            (zadani 17. 9. 2026: „nastaveni a parovani banky bych mel videt
            jen ja a Bara Siblova"). */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={vidiBanku}
                onChange={(e) => setVidiBanku(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Vidí sekci Banka
                <span className="block text-xs text-muted">
                  pohyby na účtu, párování plateb a napojení účtu v Dokladech
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Zvonek pri zmene u projektu (zadani 18. 9. 2026: „potrebuju jeste
            at Peter vidi ve zvonecku notifikace o zmene datumu a zmene stavu
            projektu"). Vychozi je NE - jinak by zvonek zvonil vsem u kazde
            zmeny a prestal by se cist. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sledujeZmeny}
                onChange={(e) => setSledujeZmeny(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Hlídá změny u projektů
                <span className="block text-xs text-muted">
                  zvoneček se ozve, když se u projektu změní stav nebo termín
                </span>
              </span>
            </label>
          </div>
        )}

        {/* ÚČET JEN NA PROHLÍŽENÍ (zadání 18. 9. 2026: „profil pro uživatele,
            který nemůže nic měnit, jen si může vyzkoušet celý portál z různých
            rolí. Herec, Tým, Klient").

            Schválně u každé role, ne jen u Mediaspace: účet si roli stejně
            přepíná sám v liště. Role a firma na téhle kartě rozhodují jen
            o tom, ČÍ zakázky uvidí v pohledu Klient - proto se takový účet
            zakládá jako Klient nějaké firmy. */}
        <div className="flex-1 min-w-[240px] flex items-end">
          <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={jenNahled}
              onChange={(e) => setJenNahled(e.target.checked)}
              className="w-4 h-4 accent-brand-purple"
            />
            <span className="text-sm font-body text-ink">
              Náhledový účet (nic nemění)
              <span className="block text-xs text-muted">
                v liště si přepíná Tým / Klient / Herec a nic z portálu neuloží
              </span>
            </span>
          </label>
        </div>

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

        {/* Schvalovani reklam klientem (zadani 23. 9. 2026: „u reklam ma jit
            notifikace zvoneckem na me a Petera Dratvu"). Zvonek, ne mail. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={schvaleniReklam}
                onChange={(e) => setSchvaleniReklam(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Zvonek: klient schválil reklamu
                <span className="block text-xs text-muted">
                  notifikace pokaždé, když klient odklepne spot k fakturaci
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Striha externe (zadani 23. 9. 2026: „vyjimka je Matej Suk, ktery
            striha externe"). V kalendari u jeho udalosti sviti letadlo
            a studio se u nich nepocita jako obsazene. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={strihaExterne}
                onChange={(e) => setStrihaExterne(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Stříhá externě
                <span className="block text-xs text-muted">
                  v kalendáři svítí letadlo a jeho práce nedrží místo ve studiu
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Znacka stavu nabidky u reklam (zadani 23. 9. 2026: „chtel bych
            nekde videt (jen ja) ... ze je nabidka schvalena"). */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={nabidkyReklam}
                onChange={(e) => setNabidkyReklam(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Vidí stav nabídky u reklam
                <span className="block text-xs text-muted">
                  značka čeká / schválena / neschválena v přehledu i v detailu
                </span>
              </span>
            </label>
          </div>
        )}

        {/* I ZVUKAŘ (zadání 22. 9. 2026: „aby se mohl občas i přidat jako
            zvukař k některým projektům"). Účet si nechá svou roli. */}
        {isMediaspace && role !== 'ZVUKAR' && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={takyZvukar}
                onChange={(e) => setTakyZvukar(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Může být i zvukař
                <span className="block text-xs text-muted">
                  nabízí se mezi zvukaři u natáčení a střihu v kalendáři
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Nova objednavka od klienta (zadani 14. 9. 2026: "jednotlive adresy
            uzivatelu tymu, ktere si nastavim na webu v portalu"). Driv chodila
            objednavka na jednu spolecnou schranku z promenne prostredi, ktera
            se nedala z portalu ani precist, natoz zmenit. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dostavaObjednavky}
                onChange={(e) => setDostavaObjednavky(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Dostává objednávky
                <span className="block text-xs text-muted">
                  mail i zvoneček pokaždé, když klient odešle objednávku; klient tuhle adresu nevidí
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Vyplnene udaje z odkazu (zadani 16. 9. 2026: „zahlasi Karoline -
            tohle bych chtel mit ale taky moznost menit do budoucna, komu to
            bude hlasit"). Proto prepinac u uctu, ne jmeno v kodu. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dostavaVyplneneUdaje}
                onChange={(e) => setDostavaVyplneneUdaje(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Dostává vyplněné údaje herců
                <span className="block text-xs text-muted">
                  mail i zvoneček pokaždé, když herec vyplní údaje po pozvánce
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Vychozi manazer audioknih (zadani 15. 9. 2026: „manazer projektu
            u audioknih je vzdy Karolina"). Projekt z objednavky audioknihy
            dostane rovnou jeho, at nezustava nicí. */}
        {isMediaspace && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={vychoziManazerAudioknih}
                onChange={(e) => setVychoziManazerAudioknih(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Vede objednané audioknihy
                <span className="block text-xs text-muted">
                  projekt z objednávky audioknihy se rovnou přiřadí jemu jako manažerovi
                </span>
              </span>
            </label>
          </div>
        )}

        {/* UPOZORNENI KLIENTOVI NA DOTOCENEHO HERCE (zadani 16. 9. 2026:
            „potrebuji mit moznost nastavit u konkretnich klientu, aby jim
            chodily notifikace o tom, ze jsme dotocili s konkretnim hercem").
            Tyka se jen projektu, u kterych je tenhle clovek napsany jako
            klient - tedy tech, ktere v portalu vidi. Tyz prepinac ma
            i u sebe v „Muj ucet", at si to zapne a vypne sam. */}
        {isKlient && (
          <div className="flex-1 min-w-[240px] flex items-end">
            <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dostavaDotocenoKlient}
                onChange={(e) => setDostavaDotocenoKlient(e.target.checked)}
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">
                Upozornit na dotočeného herce
                <span className="block text-xs text-muted">
                  mail i zvoneček, když u jeho projektu dotočíme s hercem
                </span>
              </span>
            </label>
          </div>
        )}

        {needsCompany && (
          <div className="flex-1 min-w-[200px]">
            <AdminField label="Firma" required>
              <VyberPole required value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="admin-input">
                <option value="">— vyberte firmu —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </VyberPole>
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
              <DatumPole value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="admin-input" />
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
            <div className="flex flex-wrap gap-2">
              {LOKACE_S_BARVOU.map((studio) => (
                <Volba
                  key={studio.nazev}
                  vybrano={studioLocations.includes(studio.nazev)}
                  onZmena={() => toggleStudio(studio.nazev)}
                  title={studio.nazev}
                >
                  <span
                    className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-heading font-semibold ${studio.barva}`}
                  >
                    {studio.popisek}
                  </span>
                </Volba>
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
                <CountrySelect value={addressCountry} onChange={setAddressCountry} />
              </AdminField>
            </div>
          </div>

          {/* HEREC MŮŽE BÝT ZÁROVEŇ DODAVATEL (zadání 16. 9. 2026: „někdy se
              nám stane, že herec je i dodavatel… aby pak byl zároveň herec,
              ale i dodavatel"). Nepřesouvá se, zdvojuje se: z karty vznikne
              firma typu Dodavatel a herec zůstane hercem. Smlouva o dílo si
              protistranu bere právě z dodavatelů, takže bez téhle firmy
              s ním nejde uzavřít.

              Zakládá se z ÚDAJŮ, KTERÉ JSOU NA KARTĚ TEĎ, proto je tlačítko
              až pod nimi - kdo doplní IČ a adresu, má je rovnou i ve firmě. */}
          <div className="border-t border-line pt-4 flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <p className="font-heading font-semibold text-sm text-ink m-0">Také dodavatel</p>
              <p className="text-xs font-body text-muted m-0 mt-1">
                {dodavatel
                  ? 'Herec je zároveň veden jako firma mezi dodavateli. Smlouvu o dílo s ním uzavřete přes ni.'
                  : 'Založí z téhle karty firmu mezi dodavateli. Hercem zůstává — jen s ním půjde uzavřít i smlouvu o dílo. Nejdřív uložte IČ a adresu, převezmou se do firmy.'}
              </p>
            </div>
            {dodavatel ? (
              <Link
                href={`/admin/companies/${dodavatel.id}`}
                className="text-sm font-heading font-semibold text-brand-purple no-underline rounded-pill border border-brand-purple px-3 py-1.5"
              >
                Otevřít {dodavatel.code ? `${dodavatel.name} (${dodavatel.code})` : dodavatel.name}
              </Link>
            ) : (
              <button
                type="button"
                disabled={prenaseni}
                onClick={() => void prenesDoDodavatelu()}
                className="text-sm font-heading font-semibold rounded-pill border border-line px-3 py-1.5 text-ink hover:border-brand-purple hover:text-brand-purple transition-colors disabled:opacity-60"
              >
                {prenaseni ? 'Zakládám…' : 'Přenést do dodavatelů'}
              </button>
            )}
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
