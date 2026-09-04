'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Nesprávný e-mail nebo heslo.');
      return;
    }
    router.push('/projekty');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mediaspace-logo.gif" alt="MS Portal" className="h-20 w-20 mx-auto" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-brand-purple rounded-card p-8 flex flex-col gap-5 shadow-sm"
        >
          <h1 className="font-display text-2xl text-brand-green m-0">Přihlášení</h1>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-white text-sm font-body">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border-[1.5px] border-brand-green px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-white focus:ring-2 focus:ring-white/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-white text-sm font-body">
              Heslo
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border-[1.5px] border-brand-green px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-white focus:ring-2 focus:ring-white/40"
            />
          </div>

          {error && <p className="text-white bg-red-500/30 rounded-lg px-3 py-2 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 border-2 border-brand-green text-brand-green font-heading font-semibold rounded-lg py-2.5 hover:bg-brand-green hover:text-brand-purpleDark transition-colors disabled:opacity-60"
          >
            {loading ? 'Přihlašuji…' : 'Přihlásit se'}
          </button>
        </form>

        <p className="text-center text-muted text-xs mt-6 font-body">
          Účet vám založí MEDIA SPACE. Zapomenuté heslo řešte prosím přímo s námi.
        </p>
      </div>
    </main>
  );
}
