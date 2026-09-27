'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { Currency } from '@prisma/client';
import { CURRENCIES, CURRENCY_LABELS, nazevMeny } from '@/lib/doklady';
import { VyberPole } from '@/components/VyberPole';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

type Account = {
  id: string;
  label: string;
  accountNumber: string | null;
  iban: string | null;
  swift: string | null;
  bankName: string | null;
  currency: Currency;
  isDefault: boolean;
  /** IBAN pro QR platbu - vyplněný, nebo dopočítaný z čísla účtu a kódu banky. */
  qrIban: string | null;
};

/** IBAN po čtveřicích, ať se dá přečíst. */
function citelnyIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Bankovní účty vlastní firmy - klidně několik, každý ve své měně
 * (zadani 8. 9. 2026: "bude dobré mít i možnost nastavit více účtů").
 * Na dokladu se pak nabídne účet, který sedí na měnu dokladu.
 */
export function BankAccounts({ issuerId, accounts }: { issuerId: string; accounts: Account[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    label: '',
    accountNumber: '',
    iban: '',
    swift: '',
    bankName: '',
    currency: 'CZK' as Currency,
    isDefault: false,
  });

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('mojeFirmy.ulozeniSelhalo'));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(t('mojeFirmy.ulozeniSelhalo'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send(`/api/admin/issuers/${issuerId}/ucty`, 'POST', draft);
    if (ok) {
      setDraft({ label: '', accountNumber: '', iban: '', swift: '', bankName: '', currency: 'CZK', isDefault: false });
      setAdding(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface border border-line rounded-card p-6 flex flex-col gap-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('mojeFirmy.bankovniUcty')}
        </h2>
        <span className="text-xs text-muted font-body">{t('mojeFirmy.uctyPodleMeny')}</span>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted font-body m-0">{t('mojeFirmy.zadnyUcet')}</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 py-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-heading font-semibold text-sm text-ink m-0">
                  {a.label}
                  <span className="ml-2 text-[10px] font-heading font-bold text-brand-purpleDeep bg-tint rounded px-1.5 py-0.5">
                    {CURRENCY_LABELS[a.currency]}
                  </span>
                  {a.isDefault && (
                    <span className="ml-2 text-xs text-status-done font-heading">{t('mojeFirmy.vychozi')}</span>
                  )}
                </p>
                <p className="text-xs text-muted font-body m-0 mt-0.5 tabular-nums">
                  {[a.accountNumber, a.iban, a.swift, a.bankName].filter(Boolean).join(' · ') || '—'}
                </p>
                {/* Bez IBANu se na fakturu nevykreslí QR platba a není z čeho
                    to poznat (zadání 13. 9. 2026). Tak ať to je vidět tady. */}
                {a.qrIban ? (
                  <p className="text-xs font-body text-status-done m-0 mt-0.5 tabular-nums">
                    {t('mojeFirmy.qrPlatba', { iban: citelnyIban(a.qrIban) })}
                  </p>
                ) : (
                  <p className="text-xs font-body text-danger m-0 mt-0.5">{t('mojeFirmy.bezQrPlatby')}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {!a.isDefault && (
                  <button
                    type="button"
                    onClick={() => send(`/api/admin/ucty/${a.id}`, 'PATCH', { isDefault: true })}
                    disabled={busy}
                    className="text-brand-purple text-sm font-heading disabled:opacity-60"
                  >
                    {t('mojeFirmy.nastavitVychozi')}
                  </button>
                )}
                <TlacitkoSmazat
                  onSmazat={() => send(`/api/admin/ucty/${a.id}`, 'DELETE')}
                  disabled={busy}
                  otazka={t('mojeFirmy.opravduSmazatUcet')}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      {adding ? (
        <form onSubmit={addAccount} className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('mojeFirmy.oznaceni')}</span>
              <input
                required
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder={t('mojeFirmy.oznaceniPlaceholder')}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('mojeFirmy.mena')}</span>
              <VyberPole
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value as Currency })}
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {nazevMeny(c, jazyk)}
                  </option>
                ))}
              </VyberPole>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('mojeFirmy.cisloUctu')}</span>
              <input
                value={draft.accountNumber}
                onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                placeholder="3169021011/3030"
                className={inputClass}
              />
              <span className="text-xs font-body text-muted">{t('mojeFirmy.cisloUctuNapoveda')}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('mojeFirmy.banka')}</span>
              <input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">IBAN</span>
              <input value={draft.iban} onChange={(e) => setDraft({ ...draft, iban: e.target.value })} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">SWIFT / BIC</span>
              <input value={draft.swift} onChange={(e) => setDraft({ ...draft, swift: e.target.value })} className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-heading text-ink">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
            />
            {t('mojeFirmy.vychoziUcetProMenu')}
          </label>
          <div className="flex items-center gap-3">
            <AddButton type="submit" disabled={busy}>
              {t('mojeFirmy.pridatUcet')}
            </AddButton>
            <button type="button" onClick={() => setAdding(false)} className="text-muted text-sm font-heading">
              {t('obecne.zrusit')}
            </button>
          </div>
        </form>
      ) : (
        <AddButton type="button" onClick={() => setAdding(true)} className="self-start">
          {t('mojeFirmy.pridatUcet')}
        </AddButton>
      )}
    </div>
  );
}
