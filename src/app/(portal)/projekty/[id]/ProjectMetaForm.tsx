'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIORITY_LABELS, PRIORITY_OPTIONS, projectTypeLabel } from '@/lib/projectTypes';
import { STAVY_PROJEKTU, popisStavu } from '@/lib/stavyProjektu';
import { VyberHerce, type Herec } from '../VyberHerce';
import { OdkazTlacitko } from '@/app/(portal)/components/OdkazTlacitko';

type Initial = {
  driveUrl: string;
  managerUserId: string;
  priority: string;
  projectType: string;
  /** Stav projektu - od 10. 9. 2026 vlastni udaj portalu, ne z Caflou. */
  statusName: string;
  /** Ucet herce - herec je konkretni osoba, ne text (zadani 10. 9. 2026). */
  actorUserId: string;
  /** Klient projektu - na nej chodi notifikace o projektu. */
  klientUserId: string;
  /** Firma, pro kterou se projekt dela. */
  companyId: string;
};

/**
 * Interni atributy projektu (zadani 5. 9. 2026) - odkaz na KZ, manazer
 * projektu, priorita, typ projektu. Pri canEdit=false (zvukar) se stejna
 * data jen vypisou ke cteni; skutecnou kontrolu prav dela server (viz
 * /api/projects/[id]/meta).
 */
export function ProjectMetaForm({
  caflouProjectId,
  canEdit,
  managers,
  klienti,
  firmy,
  herci,
  herecZCaflou,
  klientNameZCaflou,
  companyDriveFolderUrl,
  projectTypeOptions,
  initial,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  managers: { id: string; label: string }[];
  /** Ucty klientu, ze kterych jde vybrat, ci ten projekt je. */
  klienti: { id: string; label: string; companyId: string | null }[];
  /** Klientske firmy - pro kterou firmu se projekt dela. */
  firmy: { id: string; label: string }[];
  /** Ucty hercu. */
  herci: Herec[];
  /** Jmeno herce z Caflou - voditko, dokud neni pridelen ucet. */
  herecZCaflou: string | null;
  /** Stitek z Caflou se jmenem objednavajici osoby - voditko pri prirazovani. */
  klientNameZCaflou: string | null;
  companyDriveFolderUrl: string | null;
  /** Nazvy polozek ceniku - jen z nich jde typ projektu vybrat (zadani 5. 9. 2026). */
  projectTypeOptions: string[];
  initial: Initial;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Smazani projektu (zadani 10. 9. 2026) - jen kdyz na nem nic nevisi.
  const [maze, setMaze] = useState(false);
  const [potvrzeni, setPotvrzeni] = useState(false);

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  /** Smaze projekt. Prvni kliknuti si rekne o potvrzeni. */
  async function smaz() {
    if (!potvrzeni) {
      setPotvrzeni(true);
      setError(null);
      return;
    }
    setMaze(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projekty/${caflouProjectId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Projekt se nepodařilo smazat.');
        setPotvrzeni(false);
        return;
      }
      router.push('/projekty');
      router.refresh();
    } catch {
      setError('Projekt se nepodařilo smazat.');
      setPotvrzeni(false);
    } finally {
      setMaze(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const managerLabel = managers.find((m) => m.id === values.managerUserId)?.label ?? '—';

  if (!canEdit) {
    return (
      <div className="bg-surface rounded-card border border-line shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Interní údaje
          </h2>
          <span className="text-xs font-heading text-muted bg-field border border-line rounded-pill px-3 py-1">
            Jen ke čtení
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 m-0">
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Odkaz na KZ</dt>
            <dd className="text-sm font-heading m-0 mt-1">
              <OdkazTlacitko url={values.driveUrl} popisek="Otevřít složku" varianta="vedlejsi" />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Stav projektu</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">{values.statusName || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Herec</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {herci.find((h) => h.id === values.actorUserId)?.label ?? herecZCaflou ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Firma</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {firmy.find((f) => f.id === values.companyId)?.label ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Klient</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {klienti.find((k) => k.id === values.klientUserId)?.label ?? klientNameZCaflou ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Manažer projektu</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">{managerLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Priorita</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {values.priority ? PRIORITY_LABELS[values.priority as keyof typeof PRIORITY_LABELS] : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Typ projektu</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">{projectTypeLabel(values.projectType) ?? '—'}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Interní údaje</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-body text-ink">Odkaz na KZ</span>
          <input
            type="url"
            placeholder="https://drive.google.com/..."
            value={values.driveUrl}
            onChange={(e) => set('driveUrl', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          />
          <span className="text-xs text-muted font-body">Složka projektu na Google Disku.</span>
          {/* Odkazy jako tlacitka i s kopirovanim (zadani 10. 9. 2026) - adresa
              slozky je dlouha a jako podtrzeny text se spatne trefuje. */}
          <span className="flex items-center gap-3 flex-wrap mt-1">
            <OdkazTlacitko url={values.driveUrl} popisek="Otevřít složku projektu" varianta="vedlejsi" />
            {companyDriveFolderUrl && (
              <OdkazTlacitko url={companyDriveFolderUrl} popisek="Složka firmy" varianta="vedlejsi" />
            )}
          </span>
        </label>

        {/* Stav a herec se od 10. 9. 2026 prehazuji rucne (odchod z Caflou).
            Stav je prvni, protoze se s nim pracuje nejcasteji. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Stav projektu</span>
          <select
            value={values.statusName}
            onChange={(e) => set('statusName', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {/* Stav prenesen z Caflou, ktery v nasi ceste projektu neni - at se
                pri ulozeni nezmeni na "nevybráno". */}
            {values.statusName && !STAVY_PROJEKTU.some((st) => st.nazev === values.statusName) && (
              <option value={values.statusName}>{values.statusName} (starý stav z Caflou)</option>
            )}
            {STAVY_PROJEKTU.map((st) => (
              <option key={st.nazev} value={st.nazev}>
                {st.nazev}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted font-body">
            {popisStavu(values.statusName) ?? 'Stav přehazujete ručně podle toho, kde projekt je.'}
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Herec</span>
          <VyberHerce
            herci={herci}
            hodnota={values.actorUserId}
            onZmena={(id) => set('actorUserId', id)}
            puvodniText={herecZCaflou}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Firma</span>
          <select
            value={values.companyId}
            onChange={(e) => set('companyId', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {firmy.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted font-body">Pro koho se projekt dělá.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Klient</span>
          <select
            value={values.klientUserId}
            onChange={(e) => set('klientUserId', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {/* Nahore lide z vybrane firmy, pod nimi zbytek - u koprodukci
                sedi u projektu clovek odjinud, takze se nabidka neomezuje. */}
            {values.companyId && klienti.some((k) => k.companyId === values.companyId) && (
              <optgroup label="Z vybrané firmy">
                {klienti
                  .filter((k) => k.companyId === values.companyId)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup label="Ostatní">
              {klienti
                .filter((k) => !values.companyId || k.companyId !== values.companyId)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
            </optgroup>
          </select>
          <span className="text-xs text-muted font-body">
            {klientNameZCaflou
              ? `Na tuhle osobu chodí zprávy o projektu. V Caflou tu byl štítek „${klientNameZCaflou}".`
              : 'Na tuhle osobu chodí zprávy o projektu.'}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Manažer projektu</span>
          <select
            value={values.managerUserId}
            onChange={(e) => set('managerUserId', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Priorita</span>
          <select
            value={values.priority}
            onChange={(e) => set('priority', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-body text-ink">Typ projektu</span>
          <select
            value={values.projectType}
            onChange={(e) => set('projectType', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {/* Ulozeny typ, ktery uz v ceniku neni (vyrazena polozka), at se
                pri ulozeni nezmeni na "nevybráno". */}
            {values.projectType && !projectTypeOptions.includes(values.projectType) && (
              <option value={values.projectType}>{values.projectType} (mimo ceník)</option>
            )}
            {projectTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted font-body">
            {projectTypeOptions.length > 0
              ? 'Nabídka se bere z Ceníků v administraci.'
              : 'Ceník je zatím prázdný — typy projektu se přidávají v administraci v sekci Ceníky.'}
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        {saved && <span className="text-sm font-heading text-brand-greenDeep">Uloženo.</span>}
      </div>

      {/* Smazani projektu (zadani 10. 9. 2026) - jen kdyz na nem nic nevisi. */}
      <div className="border-t border-line pt-4 flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <p className="font-heading font-semibold text-sm text-ink m-0">Smazat projekt</p>
          <p className="text-xs font-body text-muted m-0 mt-1">
            Jen když na něm nevisí žádný doklad, výkaz ani frekvence — jinak portál napíše co.
            Složka na Disku zůstane, tu si smažte sami, pokud ji nechcete. Nevratné.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void smaz()}
          disabled={maze}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2.5 bg-danger text-white hover:brightness-95 transition-colors disabled:opacity-60"
        >
          {maze ? 'Mažu…' : potvrzeni ? 'Opravdu smazat?' : 'Smazat projekt'}
        </button>
      </div>
    </form>
  );
}
