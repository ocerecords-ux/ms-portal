'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';

/**
 * Založení faktury. Buď z odsouhlasené nabídky (převezme se odběratel, měna,
 * předmět i všechny položky), nebo od nuly - to je ta rychlejší cesta a proto
 * je nabízená jako první.
 */
export function NewInvoiceForm({
  issuers,
  companies,
  offers,
}: {
  issuers: { id: string; name: string; isDefault: boolean }[];
  companies: { id: string; name: string }[];
  offers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Prisel sem clovek pres rychlou volbu z leveho panelu? Pak rovnou
  // rozbalit - zkratka ma vest do editacniho okna, ne jen na stranku
  // (zadani 9. 9. 2026).
  useOtevriZeZkratky(() => setOpen(true));
  const [mode, setMode] = useState<'offer' | 'blank'>(offers.length > 0 ? 'offer' : 'blank');
  const [offerId, setOfferId] = useState(offers[0]?.id ?? '');
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
      // Prazdna faktura se uz nezaklada kliknutim - clovek jde do editoru,
      // uvidi vedle formulare hotovy doklad a ulozi ho, az bude sedet
      // (zadani 10. 9. 2026). Diky tomu nezustavaji po rozmysleni
      // rozpracovane doklady ani diry v ciselne rade.
      if (mode === 'blank') {
        const parametry = new URLSearchParams({ vydavatel: issuerCompanyId });
        if (companyId) parametry.set('firma', companyId);
        if (subject.trim()) parametry.set('predmet', subject.trim());
        router.push(`/admin/doklady/faktury/nova?${parametry.toString()}`);
        return;
      }

      const body = { offerId };
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Fakturu se nepodařilo založit.');
        return;
      }
      router.push(`/admin/doklady/faktury/${data.id}`);
      router.refresh();
    } catch {
      setError('Fakturu se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!open) {
    return (
      <span id={KOTVA_NOVE}>
        <AddButton onClick={() => setOpen(true)}>Nová faktura</AddButton>
      </span>
    );
  }

  return (
    <form id={KOTVA_NOVE}
      onSubmit={submit}
      className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3 w-full max-w-xl"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nová faktura</h2>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode('offer')}
          disabled={offers.length === 0}
          className={`px-4 py-2 text-sm font-heading font-semibold rounded-pill transition-colors disabled:opacity-40 ${
            mode === 'offer' ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
          }`}
        >
          Z nabídky
        </button>
        <button
          type="button"
          onClick={() => setMode('blank')}
          className={`px-4 py-2 text-sm font-heading font-semibold rounded-pill transition-colors ${
            mode === 'blank' ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
          }`}
        >
          Prázdná
        </button>
      </div>

      {mode === 'offer' ? (
        offers.length === 0 ? (
          <p className="text-sm text-muted font-body m-0">
            Zatím není žádná odsouhlasená nabídka, ze které by šlo fakturu vystavit.
          </p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Odsouhlasená nabídka</span>
            <select value={offerId} onChange={(e) => setOfferId(e.target.value)} className={inputClass}>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted font-body">
              Převezme se odběratel, měna, předmět i všechny položky.
            </span>
          </label>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Vystavuje</span>
              <select
                value={issuerCompanyId}
                onChange={(e) => setIssuerCompanyId(e.target.value)}
                className={inputClass}
              >
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
        </>
      )}

      {error && <p className="text-sm text-danger m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <AddButton type="submit" disabled={busy || (mode === 'offer' ? !offerId : !companyId)}>
          {busy ? 'Zakládám…' : 'Založit a vyplnit'}
        </AddButton>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zrušit
        </button>
      </div>
    </form>
  );
}
