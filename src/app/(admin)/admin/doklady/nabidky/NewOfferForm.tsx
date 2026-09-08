'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Založení nabídky. Schválně jen tři pole - za koho, komu a čeho se týká.
 * Zbytek se doplňuje rovnou v nabídce, aby se nezakládalo přes dlouhý formulář.
 */
export function NewOfferForm({
  issuers,
  companies,
}: {
  issuers: { id: string; name: string; isDefault: boolean }[];
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [issuerCompanyId, setIssuerCompanyId] = useState(
    issuers.find((i) => i.isDefault)?.id ?? issuers[0]?.id ?? '',
  );
  const [companyId, setCompanyId] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuerCompanyId, companyId, subject }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Nabídku se nepodařilo založit.');
        return;
      }
      router.push(`/admin/doklady/nabidky/${data.id}`);
      router.refresh();
    } catch {
      setError('Nabídku se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors"
      >
        + Nová nabídka
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white border border-line rounded-card shadow-sm p-5 flex flex-col gap-3 w-full max-w-xl"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nová nabídka</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Vystavuje</span>
          <select value={issuerCompanyId} onChange={(e) => setIssuerCompanyId(e.target.value)} className={inputClass}>
            {issuers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Odběratel</span>
          <select required value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputClass}>
            <option value="">— vyberte firmu —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Předmět</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="např. Výroba audioknihy Tři mušketýři"
          className={inputClass}
        />
      </label>

      {error && <p className="text-sm text-red-600 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !companyId}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {busy ? 'Zakládám…' : 'Založit a vyplnit'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zrušit
        </button>
      </div>
    </form>
  );
}
