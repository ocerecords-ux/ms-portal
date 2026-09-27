'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDatumCas, prelozitKolem } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

type StudioTabule = {
  id: string;
  nazev: string;
  barva: string;
  klic: string | null;
  /** Okno s Instagramem na tabuli (22. 9. 2026). */
  instagram: boolean;
  /** Účty počítačů u obrazovky (role Tabule ve studiu) - 22. 9. 2026. */
  ucty: { id: string; email: string; aktivni: boolean }[];
  chybi: { polozka: string; nazev: string; kdy: string }[];
  poznamky: { id: string; text: string; autor: string | null; kdy: string }[];
};

/**
 * TABULE VE STUDIÍCH (zadání 21. 9. 2026). Tady se tabule zapíná a bere se
 * adresa, kterou se otevře na displeji ve studiu. Zároveň je tu vidět, co
 * ve studiích chybí a jaké poznámky tam visí - a jde to odškrtnout i odsud.
 */
type StavInstagramu = {
  nastaven: boolean;
  ucet: string | null;
  platiDo: string | null;
  chyba: string | null;
  hlaska: string | null;
};

export function TabuleStudii({
  studia,
  zaklad,
  instagram,
}: {
  studia: StudioTabule[];
  zaklad: string;
  instagram: StavInstagramu;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [pracuji, setPracuji] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState<string | null>(null);
  /** Právě vymyšlené přihlašovací údaje - ukážou se jednou (22. 9. 2026). */
  const [udaje, setUdaje] = useState<{ studioId: string; login: string; heslo: string } | null>(null);
  const [chybaUctu, setChybaUctu] = useState<string | null>(null);

  async function vytvorUcet(studioId: string, noveHeslo: boolean) {
    if (noveHeslo && !window.confirm(t('studia.potvrditHeslo'))) return;
    setPracuji(studioId);
    setChybaUctu(null);
    const res = await fetch(`/api/admin/studia/${studioId}/tabule/ucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => null);
    const telo = res ? await res.json().catch(() => ({})) : {};
    setPracuji(null);
    if (!res?.ok) {
      setChybaUctu(telo.error || t('studia.ucetSelhal'));
      return;
    }
    setUdaje({ studioId, login: telo.login, heslo: telo.heslo });
    router.refresh();
  }

  async function odpojInstagram() {
    if (!window.confirm(t('studia.potvrditOdpojitInstagram'))) return;
    await fetch('/api/admin/instagram', { method: 'DELETE' }).catch(() => null);
    router.refresh();
  }

  async function instagramStudia(studioId: string, zapnuto: boolean) {
    await fetch('/api/admin/instagram', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studioId, zapnuto }),
    }).catch(() => null);
    router.refresh();
  }

  async function zrusUcet(studioId: string, ucetId: string) {
    if (!window.confirm(t('studia.potvrditZrusitUcet'))) return;
    await fetch(`/api/admin/studia/${studioId}/tabule/ucet?ucet=${encodeURIComponent(ucetId)}`, { method: 'DELETE' }).catch(() => null);
    router.refresh();
  }

  async function akce(id: string, co: 'zapnout' | 'novy' | 'vypnout') {
    if (co === 'novy' && !window.confirm(t('studia.potvrditNovaAdresa'))) return;
    if (co === 'vypnout' && !window.confirm(t('studia.potvrditVypnoutTabuli'))) return;
    setPracuji(id);
    await fetch(`/api/admin/studia/${id}/tabule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ akce: co }),
    }).catch(() => null);
    setPracuji(null);
    router.refresh();
  }

  async function doplneno(klic: string, polozka: string) {
    await fetch(`/api/tabule/${encodeURIComponent(klic)}/chybi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polozka, chybi: false }),
    }).catch(() => null);
    router.refresh();
  }

  async function odskrtni(klic: string, id: string) {
    await fetch(`/api/tabule/${encodeURIComponent(klic)}/poznamky`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    router.refresh();
  }

  const datum = (iso: string) => formatDatumCas(jazyk, new Date(iso));

  return (
    <section className="bg-surface border border-line rounded-card shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">{t('studia.tabuleNadpis')}</h2>
        <p className="text-sm text-muted m-0 mt-1 max-w-[80ch]">{t('studia.tabulePopis')}</p>
      </div>

      {/* INSTAGRAM (22. 9. 2026): příběhy z účtu studia v okně na tabuli. */}
      <div className="rounded-lg border border-line px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">Instagram</span>
          {instagram.ucet ? (
            <>
              <span className="text-sm font-heading font-semibold text-ink">@{instagram.ucet}</span>
              <span className="text-xs text-muted">{t('studia.igPribehy')}</span>
              <span className="ml-auto flex gap-3">
                <a href="/api/admin/instagram/pripojit" className="text-xs font-heading text-muted hover:text-ink no-underline">
                  {t('studia.igPripojitZnovu')}
                </a>
                <button
                  type="button"
                  onClick={() => void odpojInstagram()}
                  className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
                >
                  {t('studia.igOdpojit')}
                </button>
              </span>
            </>
          ) : instagram.nastaven ? (
            <a
              href="/api/admin/instagram/pripojit"
              className="text-sm font-heading font-semibold rounded-lg px-4 py-2 bg-brand-purple text-white no-underline"
            >
              {t('studia.igPripojit')}
            </a>
          ) : (
            <span className="text-sm text-muted">{t('studia.igCekaNaAplikaci')}</span>
          )}
        </div>
        {instagram.hlaska && (
          <span className={`text-sm ${instagram.hlaska === 'ok' ? 'text-status-done' : 'text-danger'}`}>
            {instagram.hlaska === 'ok'
              ? t('studia.igPripojeno')
              : t('studia.igPripojeniSelhalo', { duvod: instagram.hlaska })}
          </span>
        )}
        {instagram.chyba && (
          <span className="text-sm text-danger">{t('studia.igPosledniNacteni', { chyba: instagram.chyba })}</span>
        )}
      </div>

      <div className="flex flex-col divide-y divide-line">
        {studia.map((s) => {
          const adresa = s.klic ? `${zaklad}/tabule/${s.klic}` : null;
          return (
            <div key={s.id} className="py-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.barva }} />
                <span className="font-heading font-semibold text-ink">{s.nazev}</span>
                {adresa ? (
                  <>
                    <a href={adresa} target="_blank" rel="noreferrer" className="text-sm font-heading text-brand-purple truncate max-w-full">
                      {t('studia.otevritTabuli')}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(adresa);
                        setZkopirovano(s.id);
                        setTimeout(() => setZkopirovano(null), 2000);
                      }}
                      className="text-sm font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
                    >
                      {zkopirovano === s.id ? `✓ ${t('obecne.zkopirovano')}` : t('studia.kopirovatAdresu')}
                    </button>
                    <span className="ml-auto flex gap-3">
                      <button
                        type="button"
                        disabled={pracuji === s.id}
                        onClick={() => akce(s.id, 'novy')}
                        className="text-xs font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
                      >
                        {t('studia.novaAdresa')}
                      </button>
                      <button
                        type="button"
                        disabled={pracuji === s.id}
                        onClick={() => akce(s.id, 'vypnout')}
                        className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
                      >
                        {t('studia.vypnout')}
                      </button>
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pracuji === s.id}
                    onClick={() => akce(s.id, 'zapnout')}
                    className="ml-auto text-sm font-heading font-semibold rounded-lg px-4 py-2 border border-line text-ink hover:border-brand-purple disabled:opacity-60"
                  >
                    {t('studia.zapnoutTabuli')}
                  </button>
                )}
              </div>

              {instagram.ucet && (
                <label className="pl-6 flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.instagram}
                    onChange={(e) => void instagramStudia(s.id, e.target.checked)}
                  />
                  {t('studia.igUkazovat')}
                </label>
              )}

              {/* ÚČET POČÍTAČE U OBRAZOVKY (22. 9. 2026): jméno a heslo bez
                  e-mailu. Přihlásí se jím v Chromu a portál rovnou ukáže
                  tabuli tohohle studia. */}
              <div className="pl-6 flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{t('studia.ucetTabule')}</span>
                  {s.ucty.filter((u) => u.aktivni).map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-2">
                      <span className="text-muted">{t('studia.jmenoPopisek')}</span>
                      <span className="font-heading font-semibold text-ink">{u.email}</span>
                      <button
                        type="button"
                        disabled={pracuji === s.id}
                        onClick={() => void vytvorUcet(s.id, true)}
                        className="text-xs font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
                      >
                        {t('studia.hesloNa1111')}
                      </button>
                      <button
                        type="button"
                        onClick={() => zrusUcet(s.id, u.id)}
                        className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
                      >
                        {t('obecne.zrusit')}
                      </button>
                    </span>
                  ))}
                  {s.ucty.filter((u) => u.aktivni).length === 0 && (
                    <button
                      type="button"
                      disabled={pracuji === s.id}
                      onClick={() => void vytvorUcet(s.id, false)}
                      className="text-sm font-heading font-semibold text-brand-purple bg-transparent border-0 cursor-pointer"
                    >
                      + {t('studia.vytvoritUcet')}
                    </button>
                  )}
                </div>
                {udaje?.studioId === s.id && (
                  <div className="rounded-lg border border-brand-purple/40 bg-brand-purple/5 px-3 py-2 text-sm">
                    <UdajeTabule login={udaje.login} heslo={udaje.heslo} />
                  </div>
                )}
                {chybaUctu && pracuji === null && <span className="text-sm text-danger">{chybaUctu}</span>}
              </div>

              {s.klic && (s.chybi.length > 0 || s.poznamky.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{t('studia.chybi')}</span>
                    {s.chybi.length === 0 ? (
                      <span className="text-sm text-muted">{t('studia.nicNechybi')}</span>
                    ) : (
                      s.chybi.map((c) => (
                        <span key={c.polozka} className="flex items-center gap-3 text-sm">
                          <span className="font-heading font-semibold text-ink">{c.nazev}</span>
                          <span className="text-muted text-xs">{datum(c.kdy)}</span>
                          <button
                            type="button"
                            onClick={() => doplneno(s.klic!, c.polozka)}
                            className="ml-auto text-xs font-heading font-semibold text-brand-purple bg-transparent border-0 cursor-pointer"
                          >
                            {t('studia.doplneno')}
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{t('studia.poznamky')}</span>
                    {s.poznamky.length === 0 ? (
                      <span className="text-sm text-muted">{t('studia.zadnePoznamky')}</span>
                    ) : (
                      s.poznamky.map((p) => (
                        <span key={p.id} className="flex items-start gap-3 text-sm">
                          <span className="text-ink flex-1 min-w-0 break-words">{p.text}</span>
                          <span className="text-muted text-xs whitespace-nowrap">
                            {[p.autor, datum(p.kdy)].filter(Boolean).join(' · ')}
                          </span>
                          <button
                            type="button"
                            onClick={() => odskrtni(s.klic!, p.id)}
                            className="text-xs font-heading font-semibold text-brand-purple bg-transparent border-0 cursor-pointer"
                          >
                            {t('studia.odskrtnout')}
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Věta s přihlašovacími údaji. Jméno i heslo v ní stojí tlustě, takže se věta
 * dělí až při vykreslení - celá zůstává jedním klíčem (pravidlo 7
 * v docs/preklad-portalu.md) a v angličtině můžou značky stát jinde.
 */
function UdajeTabule({ login, heslo }: { login: string; heslo: string }) {
  const jazyk = useJazyk();
  const [pred, zbytek] = prelozitKolem(jazyk, 'studia.udajeTabule', 'login');
  const [mezi, za] = zbytek.split('{heslo}');
  return (
    <>
      {pred}
      <strong className="font-heading">{login}</strong>
      {mezi}
      <strong className="font-heading tracking-wide">{heslo}</strong>
      {za ?? ''}
    </>
  );
}
