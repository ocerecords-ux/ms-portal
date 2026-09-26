'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatSignedAt } from '@/lib/contracts';
import { PodpisVyber } from '@/app/(admin)/admin/doklady/smlouvy/PodpisVyber';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

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
  jazyk,
}: {
  token: string;
  status: string;
  signerName: string;
  alreadySigned: boolean;
  completedAt: string | null;
  rejectedAt: string | null;
  issuerName: string;
  /** Veřejná stránka stojí mimo JazykProvider - jazyk chodí propem. */
  jazyk: Jazyk;
}) {
  const t = (klic: string, hodnoty?: Record<string, string | number>) =>
    hodnoty ? prelozitS(jazyk, klic, hodnoty) : prelozit(jazyk, klic);
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
        setError(data?.error || t('smlouvaVerejna.chyba'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('smlouvaVerejna.chyba'));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'CANCELLED') {
    return (
      <div className="bg-dangerTint border border-line rounded-card p-6 text-center">
        <p className="font-display text-2xl text-ink m-0">{t('smlouvaVerejna.zrusena')}</p>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {t('smlouvaVerejna.zrusenaText', { firma: issuerName })}
        </p>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="bg-dangerTint border border-line rounded-card p-6 text-center">
        <p className="font-display text-2xl text-ink m-0">{t('smlouvaVerejna.odmitnut')}</p>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {t('smlouvaVerejna.odmitnutText', { kdy: formatSignedAt(rejectedAt, jazyk), firma: issuerName })}
        </p>
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="bg-okTint border border-line rounded-card p-6 text-center">
        <p className="font-display text-2xl text-ink m-0">
          {t(status === 'SIGNED' ? 'smlouvaVerejna.podepsana' : 'smlouvaVerejna.podpisUlozeny')}
        </p>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {status === 'SIGNED'
            ? t('smlouvaVerejna.uzavreno', { kdy: formatSignedAt(completedAt, jazyk) })
            : t('smlouvaVerejna.cekaNaNas', { firma: issuerName })}
        </p>
      </div>
    );
  }

  if (odmitam) {
    return (
      <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('smlouvaVerejna.odmitnutiNadpis')}
        </h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('smlouvaVerejna.coNesedi')}</span>
          <textarea
            value={duvod}
            onChange={(e) => setDuvod(e.target.value)}
            rows={4}
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
          />
        </label>
        {error && <p className="text-sm text-danger m-0">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => posli({ action: 'reject', reason: duvod })}
            disabled={busy}
            className="bg-red-600 text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-60"
          >
            {t(busy ? 'smlouvaVerejna.odesilam' : 'smlouvaVerejna.odmitnoutPodpis')}
          </button>
          <button type="button" onClick={() => setOdmitam(false)} className="text-muted text-sm font-heading">
            {t('smlouvaVerejna.zpet')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
      <h2 className="font-heading font-semibold text-sm text-brand-purple uppercase tracking-wide m-0">{t('smlouvaVerejna.vasPodpis')}</h2>

      <label className="flex flex-col gap-1.5 max-w-sm">
        <span className="text-sm font-body text-ink">{t('smlouvaVerejna.jmeno')}</span>
        <input
          value={jmeno}
          onChange={(e) => setJmeno(e.target.value)}
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full"
        />
      </label>

      <PodpisVyber onChange={setPodpis} jmeno={jmeno} />

      <label className="flex items-start gap-2.5 text-sm font-body text-ink">
        <input
          type="checkbox"
          checked={souhlas}
          onChange={(e) => setSouhlas(e.target.checked)}
          className="mt-1"
        />
        <span>{t('smlouvaVerejna.souhlas')}</span>
      </label>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={() =>
            posli({ action: 'sign', name: jmeno, imageData: podpis })
          }
          disabled={busy || !podpis || !souhlas || !jmeno.trim()}
          /* Zelene jako „Schvaluji nabidku" - hlavni krok klienta ma v portalu
             vsude stejnou barvu (zadani 13. 9. 2026: „v nasem brandu"). */
          className="bg-brand-green text-onAccent font-heading font-semibold text-base rounded-lg px-6 py-3 hover:brightness-95 transition-[filter] disabled:opacity-50"
        >
          {t(busy ? 'smlouvaVerejna.podepisuji' : 'smlouvaVerejna.podepsat')}
        </button>
        <button type="button" onClick={() => setOdmitam(true)} className="text-muted text-sm font-heading">
          {t('smlouvaVerejna.nesouhlasim')}
        </button>
      </div>
    </div>
  );
}
