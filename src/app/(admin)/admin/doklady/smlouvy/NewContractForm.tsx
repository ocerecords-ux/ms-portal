'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { ProjectSelect, type ProjectChoice } from '../ProjectSelect';

/**
 * Založení smlouvy. Šablona se vybere, pole se předvyplní z databáze a text
 * se dál upravuje až v editoru — na tomhle kroku jde jen o to, aby se
 * smlouva založila na pár kliknutí.
 */
export function NewContractForm({
  issuers,
  companies,
  templates,
  projects,
}: {
  issuers: { id: string; name: string; isDefault: boolean }[];
  companies: { id: string; name: string; contactName: string | null; contactEmail: string | null }[];
  templates: { id: string; name: string }[];
  projects: ProjectChoice[];
}) {
  const router = useRouter();
  const defaultIssuer = issuers.find((i) => i.isDefault) ?? issuers[0];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    issuerCompanyId: defaultIssuer?.id ?? '',
    templateId: templates[0]?.id ?? '',
    title: '',
    companyId: '',
    signerName: '',
    signerEmail: '',
    caflouProjectId: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
      <AddButton onClick={() => setOpen(true)}>Nová smlouva</AddButton>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
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

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

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
