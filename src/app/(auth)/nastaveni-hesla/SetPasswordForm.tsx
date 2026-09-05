'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Nastaveni hesla z pozvanky - stejny vzhled jako prihlasovaci stranka. */
export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.');
      return;
    }
    if (password !== password2) {
      setError('Hesla se neshodují.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Nastavení hesla se nezdařilo.');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('Nastavení hesla se nezdařilo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep rounded-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-center gap-3 sm:gap-4 px-8 pt-9 pb-7">
            <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
            <span className="w-px h-10 sm:h-12 bg-white/40" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-16 sm:h-20 w-auto" />
          </div>

          {!token ? (
            <div className="px-8 pb-8">
              <h1 className="font-display text-2xl text-brand-green m-0 mb-3">Neplatný odkaz</h1>
              <p className="text-white/90 text-sm font-body m-0">
                V odkazu chybí ověřovací kód. Otevřete prosím odkaz z pozvánky znovu, nebo si u nás vyžádejte
                novou pozvánku.
              </p>
            </div>
          ) : done ? (
            <div className="px-8 pb-8">
              <h1 className="font-display text-2xl text-brand-green m-0 mb-3">Heslo je nastavené</h1>
              <p className="text-white/90 text-sm font-body m-0">
                Za chvíli vás přesměrujeme na přihlášení.{' '}
                <Link href="/login" className="text-brand-green underline">
                  Přihlásit se hned
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-8 pb-8 flex flex-col gap-5">
              <h1 className="font-display text-2xl text-brand-green m-0">Nastavení hesla</h1>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-white text-sm font-body">
                  Nové heslo
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-lg border-[1.5px] border-brand-green px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-white focus:ring-2 focus:ring-white/40"
                />
                <span className="text-white/70 text-xs font-body">Alespoň 8 znaků.</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password2" className="text-white text-sm font-body">
                  Heslo znovu
                </label>
                <input
                  id="password2"
                  type="password"
                  required
                  minLength={8}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="rounded-lg border-[1.5px] border-brand-green px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-white focus:ring-2 focus:ring-white/40"
                />
              </div>

              {error && <p className="text-white bg-red-500/30 rounded-lg px-3 py-2 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 border-2 border-brand-green text-brand-green font-heading font-semibold rounded-lg py-2.5 hover:bg-brand-green hover:text-brand-purpleDark transition-colors disabled:opacity-60"
              >
                {loading ? 'Ukládám…' : 'Nastavit heslo'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
