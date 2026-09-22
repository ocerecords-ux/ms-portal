'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import {
  JAZYKY,
  KLIC_JAZYKA,
  NAZVY_JAZYKU,
  PLATNOST_JAZYKA_S,
  ZKRATKY_JAZYKU,
  jeJazyk,
  prelozit,
  type Jazyk,
} from '@/lib/jazyk';

export default function LoginPage() {
  const router = useRouter();
  /**
   * Jazyk uz na prihlaseni (zadani 13. 9. 2026) - zahranicni klient nema jak
   * se prepnout az uvnitr, kdyz se nejdriv musi dostat dovnitr. Volba se
   * ulozi do cookie a portal uz ji pak zna.
   */
  const [jazyk, setJazyk] = useState<Jazyk>('cs');
  useEffect(() => {
    const ulozeny = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${KLIC_JAZYKA}=`))
      ?.split('=')[1];
    if (jeJazyk(ulozeny)) setJazyk(ulozeny);
  }, []);
  const t = (klic: string) => prelozit(jazyk, klic);
  function prepni(novy: Jazyk) {
    document.cookie = `${KLIC_JAZYKA}=${novy}; path=/; max-age=${PLATNOST_JAZYKA_S}; samesite=lax`;
    setJazyk(novy);
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  /**
   * Fáze přihlášení (zpráva 9. 9. 2026: "kliknu na přihlásit a dlouho čekám
   * a nic se neděje").
   *
   * Dřív se čekání vypnulo hned po ověření hesla - jenže tím to nekončí:
   * pak se teprve načítá stránka Projekty, která si tahá data z Caflou, a to
   * je ta delší část. Tlačítko se mezitím vrátilo do klidového stavu a
   * vypadalo, jako by se klik ztratil. Teď čekání běží až do překreslení
   * portálu a rovnou říká, na co se čeká.
   */
  const [phase, setPhase] = useState<'idle' | 'signing' | 'redirecting'>('idle');
  const loading = phase !== 'idle';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase('signing');
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setPhase('idle');
      // Do 5. 9. 2026 tu byla u KAZDE chyby hlaska "Nesprávný e-mail nebo
      // heslo" - i kdyz prihlaseni spadlo na necem uplne jinem (nedostupna
      // databaze, chybejici NEXTAUTH_SECRET...). Spatne heslo hlasi NextAuth
      // jako "CredentialsSignin"; cokoliv jineho je chyba serveru a ma to i
      // tak vypadat, at se to da dohledat.
      setError(
        res.error === 'CredentialsSignin'
          ? t('prihlaseni.spatneUdaje')
          : `${t('prihlaseni.chybaServeru')} (${res.error})`,
      );
      return;
    }
    // Čekání schválně nevypínáme - pokračuje se přesměrováním do portálu.
    setPhase('redirecting');
    // Návrat tam, odkud člověk přišel - třeba odkaz na přílohu objednávky
    // z mailu (22. 9. 2026). Jen cesta v portálu, nikdy cizí adresa.
    const zpet = new URLSearchParams(window.location.search).get('callbackUrl') || '';
    const cil = zpet.startsWith('/') && !zpet.startsWith('//') ? zpet : '/projekty';
    if (cil.startsWith('/api/')) window.location.href = cil;
    else {
      router.push(cil);
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        {/* Branding i formular jsou od 5. 9. 2026 v JEDNOM fialovem bloku.
            Drive bylo logo nad kartou na bilem podkladu (bg-paper) a zelena
            v nem splyvala s pozadim ("ta zelená splývá s pozadím a je to
            nevýrazné. Pod tou zelenou musí být vždy fialová") - fialovy blok
            je proto protazeny nahoru pres logo a logo je zaroven vetsi. */}
        <div className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep rounded-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-center gap-3 sm:gap-4 px-8 pt-9 pb-7">
            <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
            <span className="w-px h-10 sm:h-12 bg-white/40" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-16 sm:h-20 w-auto" />
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-display text-2xl text-brand-green m-0">{t('prihlaseni.nadpis')}</h1>
              <span className="inline-flex items-center rounded-pill border border-white/30 overflow-hidden">
                {JAZYKY.map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => prepni(j)}
                    title={NAZVY_JAZYKU[j]}
                    aria-pressed={j === jazyk}
                    className={`px-2.5 py-1 text-[11px] font-heading font-bold tracking-wide transition-colors ${
                      j === jazyk ? 'bg-brand-green text-brand-purpleDark' : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {ZKRATKY_JAZYKU[j]}
                  </button>
                ))}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-white text-sm font-body">
                {t('prihlaseni.email')}
              </label>
              <input
                id="email"
                // Text, ne e-mail: účty obrazovek ve studiích se přihlašují
                // jménem („brno1"), e-mail nemají (22. 9. 2026).
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border-[1.5px] border-brand-green px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-white focus:ring-2 focus:ring-white/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-white text-sm font-body">
                {t('prihlaseni.heslo')}
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
              {phase === 'signing'
                ? t('prihlaseni.probiha')
                : phase === 'redirecting'
                  ? t('prihlaseni.nacitam')
                  : t('prihlaseni.tlacitko')}
            </button>

            <Link href="/zapomenute-heslo" className="text-white/80 text-xs font-body text-center hover:text-white">
              {t('prihlaseni.zapomenute')}
            </Link>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-6 font-body">{t('prihlaseni.ucetZalozi')}</p>
      </div>
    </main>
  );
}
