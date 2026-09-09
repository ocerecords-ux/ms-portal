'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { Currency } from '@prisma/client';
import { CURRENCIES, CURRENCY_LABELS, CURRENCY_NAMES } from '@/lib/doklady';

type Account = {
  id: string;
  label: string;
  accountNumber: string | null;
  iban: string | null;
  swift: string | null;
  bankName: string | null;
  currency: Currency;
  isDefault: boolean;
};

/**
 * Bankovní účty vlastní firmy - klidně několik, každý ve své měně
 * (zadani 8. 9. 2026: "bude dobré mít i možnost nastavit více účtů").
 * Na dokladu se pak nabídne účet, který sedí na měnu dokladu.
 */
export function BankAccounts({ issuerId, accounts }: { issuerId: string; accounts: Account[] }) {
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
        setError(data?.error || 'Uložení se nezdařilo.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Uložení se nezdařilo.');
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
    <div className="bg-white border border-line rounded-card p-6 flex flex-col gap-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Bankovní účty</h2>
        <span className="text-xs text-muted font-body">Na dokladu se nabídne účet ve stejné měně.</span>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted font-body m-0">Zatím tu není žádný účet.</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 py-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-heading font-semibold text-sm text-ink m-0">
                  {a.label}
                  <span className="ml-2 text-[10px] font-heading font-bold text-brand-purpleDeep bg-[#F1ECFF] rounded px-1.5 py-0.5">
                    {CURRENCY_LABELS[a.currency]}
                  </span>
                  {a.isDefault && <span className="ml-2 text-xs text-status-done font-heading">výchozí</span>}
                </p>
                <p className="text-xs text-muted font-body m-0 mt-0.5 tabular-nums">
                  {[a.accountNumber, a.iban, a.swift, a.bankName].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {!a.isDefault && (
                  <button
                    type="button"
                    onClick={() => send(`/api/admin/ucty/${a.id}`, 'PATCH', { isDefault: true })}
                    disabled={busy}
                    className="text-brand-purple text-sm font-heading disabled:opacity-60"
                  >
                    Nastavit výchozí
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => send(`/api/admin/ucty/${a.id}`, 'DELETE')}
                  disabled={busy}
                  className="text-red-600 text-sm font-heading disabled:opacity-60"
                >
                  Smazat
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      {adding ? (
        <form onSubmit={addAccount} className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Označení</span>
              <input
                required
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="např. Air Bank CZK"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Měna</span>
              <select
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value as Currency })}
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_NAMES[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Číslo účtu</span>
              <input
                value={draft.accountNumber}
                onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Banka</span>
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
            Výchozí účet pro tuhle měnu
          </label>
          <div className="flex items-center gap-3">
            <AddButton type="submit" disabled={busy}>
              Přidat účet
            </AddButton>
            <button type="button" onClick={() => setAdding(false)} className="text-muted text-sm font-heading">
              Zrušit
            </button>
          </div>
        </form>
      ) : (
        <AddButton type="button" onClick={() => setAdding(true)} className="self-start">
          Přidat účet
        </AddButton>
      )}
    </div>
  );
}
