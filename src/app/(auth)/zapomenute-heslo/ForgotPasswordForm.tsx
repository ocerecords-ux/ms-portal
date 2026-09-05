'use client';

import { useState } from 'react';
import Link from 'next/link';

/** Zapomenute heslo (zadani 5. 9. 2026) - stejny vzhled jako prihlaseni. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Vysledek zamerne neprozrazujeme ani pri chybe - viz komentar v API route.
    } finally {
      setLoading(false);
      setSent(true);
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

          {sent ? (
            <div className="px-8 pb-8">
              <h1 className="font-display text-2xl text-brand-green m-0 mb-3">Zkontrolujte e-mail</h1>
              <p className="text-white/90 text-sm font-body m-0">
                Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz pro nastavení nového hesla. Odkaz
                platí dvě hodiny.
              </p>
              <p className="text-white/90 text-sm font-body mt-4 m-0">
                <Link href="/login" className="text-brand-green underline">
                  Zpět na přihlášení
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-8 pb-8 flex flex-col gap-5">
              <h1 className="font-display text-2xl text-brand-green m-0">Zapomenuté heslo</h1>
              <p className="text-white/85 text-sm font-body m-0">
                Zadejte e-mail, kterým se přihlašujete. Pošleme vám odkaz pro nastavení nového hesla.
              </p>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-white text-sm font-body">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg border-[1.5px] border-brand-green px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-white focus:ring-2 focus:ring-white/40"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 border-2 border-brand-green text-brand-green font-heading font-semibold rounded-lg py-2.5 hover:bg-brand-green hover:text-brand-purpleDark transition-colors disabled:opacity-60"
              >
                {loading ? 'Odesílám…' : 'Poslat odkaz'}
              </button>

              <Link href="/login" className="text-white/80 text-xs font-body text-center hover:text-white">
                Zpět na přihlášení
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
