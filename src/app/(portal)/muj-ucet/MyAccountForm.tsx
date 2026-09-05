'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

type Values = {
  name: string;
  email: string;
  phone: string;
  birthDate: string;
};

/**
 * Uprava vlastnich udaju. Datum narozeni se ukazuje jen internimu tymu
 * Mediaspace (zadani 5. 9. 2026). Role, kod uctu a firma tu zamerne nejsou -
 * ty nesmi menit nikdo z uzivatelu.
 */
export function MyAccountForm({ internal, initial }: { internal: boolean; initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/me', {
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
      setEmailChanged(Boolean(data?.emailChanged));
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Kontaktní údaje</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Jméno</span>
          <input value={values.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Telefon</span>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-body text-ink">E-mail</span>
          <input
            type="email"
            required
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputClass}
          />
          <span className="text-xs text-muted font-body">Tímto e-mailem se do portálu přihlašujete.</span>
        </label>

        {internal && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Datum narození</span>
            <input
              type="date"
              value={values.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
              className={inputClass}
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        {saved && !emailChanged && <span className="text-sm font-heading text-brand-greenDeep">Uloženo.</span>}
      </div>

      {saved && emailChanged && (
        <div className="bg-[#F1ECFF] border border-line rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm font-body text-ink m-0">
            E-mail je změněný. Příště se přihlaste novou adresou — kvůli tomu je potřeba se teď odhlásit.
          </p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="bg-ink text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDark transition-colors"
          >
            Odhlásit se
          </button>
        </div>
      )}
    </form>
  );
}
