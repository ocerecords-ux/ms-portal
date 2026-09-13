'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { CONTRACT_PLACEHOLDERS } from '@/lib/contracts';
import { ProjectSelect, type ProjectChoice } from '../ProjectSelect';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';

/**
 * Založení smlouvy. Šablona se vybere, pole se předvyplní z databáze a text
 * se dál upravuje až v editoru — na tomhle kroku jde jen o to, aby se
 * smlouva založila na pár kliknutí.
 *
 * RUČNÍ POLE SE PTAJÍ ROVNOU TADY (zadání 13. 9. 2026: „na smlouvě není
 * nikde částka"). Odměnu, termín ani splatnost portál nikde nemá, takže by se
 * do textu vložilo „…" a odměna by ve smlouvě chyběla. Formulář se proto
 * podívá do vybrané šablony a zeptá se přesně na ta pole, která v ní opravdu
 * jsou — u smlouvy o dílo na rozsah díla, u reklamy na dobu licence.
 */
export function NewContractForm({
  issuers,
  companies,
  templates,
  projects,
}: {
  issuers: { id: string; name: string; isDefault: boolean }[];
  companies: { id: string; name: string; contactName: string | null; contactEmail: string | null }[];
  templates: { id: string; name: string; body: string }[];
  projects: ProjectChoice[];
}) {
  const router = useRouter();
  const defaultIssuer = issuers.find((i) => i.isDefault) ?? issuers[0];

  const [open, setOpen] = useState(false);

  // Prisel sem clovek pres rychlou volbu z leveho panelu? Pak rovnou
  // rozbalit - zkratka ma vest do editacniho okna, ne jen na stranku
  // (zadani 9. 9. 2026).
  useOtevriZeZkratky(() => setOpen(true));
  const [form, setForm] = useState({
    issuerCompanyId: defaultIssuer?.id ?? '',
    templateId: templates[0]?.id ?? '',
    title: '',
    companyId: '',
    signerName: '',
    signerEmail: '',
    caflouProjectId: '',
  });
  const [pole, setPole] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Ruční pole, která ve vybrané šabloně skutečně jsou. */
  const rucniPole = useMemo(() => {
    const sablona = templates.find((t) => t.id === form.templateId);
    if (!sablona) return [];
    return CONTRACT_PLACEHOLDERS.filter(
      (p) => p.rucne && new RegExp(`\\{\\{\\s*${p.key}\\s*\\}\\}`, 'i').test(sablona.body),
    );
  }, [templates, form.templateId]);

  /** Výběr firmy rovnou nabídne její kontaktní osobu a e-mail. */
  function vyberFirmu(id: string) {
    const company = companies.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      companyId: id,
      signerName: f.signerName || company?.contactName || '',
      signerEmail: f.signerEmail || company?.contactEmail || '',
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          companyId: form.companyId || undefined,
          caflouProjectId: form.caflouProjectId || undefined,
          templateId: form.templateId || undefined,
          pole: rucniPole.reduce<Record<string, string>>((acc, p) => {
            const hodnota = pole[p.key]?.trim();
            if (hodnota) acc[p.key] = hodnota;
            return acc;
          }, {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Smlouvu se nepodařilo založit.');
        return;
      }
      router.push(`/admin/doklady/smlouvy/${data.id}`);
    } catch {
      setError('Smlouvu se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!open) {
    return (
      <span id={KOTVA_NOVE}>
        <AddButton onClick={() => setOpen(true)}>Nová smlouva</AddButton>
      </span>
    );
  }

  return (
    <form id={KOTVA_NOVE}
      onSubmit={submit}
      className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nová smlouva</h2>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Název smlouvy</span>
        <input
          required
          autoFocus
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="např. Smlouva o hlasovém výkonu — Tři mušketýři"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Šablona</span>
          <select value={form.templateId} onChange={(e) => set('templateId', e.target.value)} className={inputClass}>
            <option value="">— prázdná smlouva —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Za naši firmu</span>
          <select
            value={form.issuerCompanyId}
            onChange={(e) => set('issuerCompanyId', e.target.value)}
            className={inputClass}
          >
            {issuers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Protistrana (firma)</span>
          <select value={form.companyId} onChange={(e) => vyberFirmu(e.target.value)} className={inputClass}>
            <option value="">— bez firmy (herec) —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Kdo podepisuje</span>
          <input
            required
            value={form.signerName}
            onChange={(e) => set('signerName', e.target.value)}
            placeholder="Jméno a příjmení"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">E-mail podepisujícího</span>
          <input
            required
            type="email"
            value={form.signerEmail}
            onChange={(e) => set('signerEmail', e.target.value)}
            placeholder="na tenhle e-mail půjde odkaz k podpisu"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Projekt</span>
        <ProjectSelect
          value={form.caflouProjectId}
          onChange={(id) => set('caflouProjectId', id)}
          projects={projects}
          className={inputClass}
        />
      </label>

      {rucniPole.length > 0 && (
        <div className="rounded-card border border-line bg-field/60 p-4 flex flex-col gap-3">
          <p className="text-sm font-body text-muted m-0">
            Co portál neví — doplní se rovnou do textu smlouvy. Co necháte prázdné, bude ve smlouvě
            jako „…" a dopíšete to v editoru.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rucniPole.map((p) => (
              <label key={p.key} className="flex flex-col gap-1.5">
                <span className="text-sm font-body text-ink">{p.label}</span>
                <input
                  value={pole[p.key] ?? ''}
                  onChange={(e) => setPole((s) => ({ ...s, [p.key]: e.target.value }))}
                  placeholder={NAPOVEDA[p.key] ?? ''}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <AddButton type="submit" disabled={busy}>
          {busy ? 'Zakládám…' : 'Založit a upravit text'}
        </AddButton>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zavřít
        </button>
      </div>
    </form>
  );
}

/** Nápověda k ručním polím — ať je vidět, v jakém tvaru to má být. */
const NAPOVEDA: Record<string, string> = {
  odmena: 'např. 5 000 Kč',
  termin: 'např. 20. 9. 2026',
  splatnost: 'např. 30',
  rodne_cislo: 'u fyzické osoby bez IČ',
  nazev_dila: 'např. KENDAMIL — SPOTIFY CZ+SK',
  rozsah_dila: 'co se dělá — překlad, úprava dialogů, dramaturgie…',
  uziti: 'např. audio reklama na Spotify, CZ+SK',
  doba_licence: 'např. jednoho (1) roku',
};
