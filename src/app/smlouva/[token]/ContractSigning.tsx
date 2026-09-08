'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatSignedAt } from '@/lib/contracts';
import { SignaturePad } from '@/app/(admin)/admin/doklady/smlouvy/SignaturePad';

/**
 * Podpisová část veřejné stránky. Bez ověřovacích kódů — identitu nese
 * jednorázový odkaz z e-mailu (zadani 8. 9. 2026).
 */
export function ContractSigning({
  token,
  status,
  signerName,
  alreadySigned,
  completedAt,
  rejectedAt,
  issuerName,
}: {
  token: string;
  status: string;
  signerName: string;
  alreadySigned: boolean;
  completedAt: string | null;
  rejectedAt: string | null;
  issuerName: string;
}) {
  const router = useRouter();
  const [jmeno, setJmeno] = useState(signerName);
  const [podpis, setPodpis] = useState<string | null>(null);
  const [souhlas, setSouhlas] = useState(false);
  const [odmitam, setOdmitam] = useState(false);
  const [duvod, setDuvod] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function posli(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/smlouva/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Akci se nepodařilo uložit.');
        return;
      }
      router.refresh();
    } catch {
      setError('Akci se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'CANCELLED') {
    return (
      <div className="bg-red-50 border border-line rounded-card p-6 text-center">
        <p className="font-display text-2xl text-ink m-0">Smlouva byla zrušena</p>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {issuerName} tuhle smlouvu stáhl. Ozvěte se prosím produkci.
        </p>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="bg-red-50 border border-line rounded-card p-6 text-center">
        <p className="font-display text-2xl text-ink m-0">Podpis odmítnut</p>
        <p className="text-sm font-body text-muted m-0 mt-2">
          Odmítnuto {formatSignedAt(rejectedAt)}. {issuerName} o tom ví a ozve se vám.
        </p>
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="bg-[#E3F9EC] border border-line rounded-card p-6 text-center">
        <p className="font-display text-2xl text-ink m-0">
          {status === 'SIGNED' ? 'Smlouva je podepsaná' : 'Váš podpis je uložený'}
        </p>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {status === 'SIGNED'
            ? `Uzavřeno ${formatSignedAt(completedAt)}. Podepsanou smlouvu máte výše i s doložkou — stránku si můžete uložit jako PDF přes tisk prohlížeče.`
            : `Děkujeme. Jakmile smlouvu podepíše i ${issuerName}, dáme vám vědět e-mailem.`}
        </p>
      </div>
    );
  }

  if (odmitam) {
    return (
      <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Odmítnutí podpisu
        </h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Co ve smlouvě nesedí? (nepovinné)</span>
          <textarea
            value={duvod}
            onChange={(e) => setDuvod(e.target.value)}
            rows={4}
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
          />
        </label>
        {error && <p className="text-sm text-red-600 m-0">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => posli({ action: 'reject', reason: duvod })}
            disabled={busy}
            className="bg-red-600 text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-60"
          >
            {busy ? 'Odesílám…' : 'Odmítnout podpis'}
          </button>
          <button type="button" onClick={() => setOdmitam(false)} className="text-muted text-sm font-heading">
            Zpět
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Váš podpis</h2>

      <label className="flex flex-col gap-1.5 max-w-sm">
        <span className="text-sm font-body text-ink">Jméno a příjmení</span>
        <input
          value={jmeno}
          onChange={(e) => setJmeno(e.target.value)}
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full"
        />
      </label>

      <SignaturePad onChange={setPodpis} />

      <label className="flex items-start gap-2.5 text-sm font-body text-ink">
        <input
          type="checkbox"
          checked={souhlas}
          onChange={(e) => setSouhlas(e.target.checked)}
          className="mt-1"
        />
        <span>
          Smlouvu jsem si přečetl(a), souhlasím s jejím zněním a podepisuji ji elektronicky. Beru na
          vědomí, že se k podpisu uloží datum a čas, IP adresa a otisk podepsaného textu.
        </span>
      </label>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => posli({ action: 'sign', name: jmeno, imageData: podpis })}
          disabled={busy || !podpis || !souhlas || !jmeno.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-6 py-3 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
        >
          {busy ? 'Podepisuji…' : 'Podepsat smlouvu'}
        </button>
        <button type="button" onClick={() => setOdmitam(true)} className="text-muted text-sm font-heading">
          Nesouhlasím, odmítnout
        </button>
      </div>
    </div>
  );
}
