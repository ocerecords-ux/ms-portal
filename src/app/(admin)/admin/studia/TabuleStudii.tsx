'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type StudioTabule = {
  id: string;
  nazev: string;
  barva: string;
  klic: string | null;
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
export function TabuleStudii({ studia, zaklad }: { studia: StudioTabule[]; zaklad: string }) {
  const router = useRouter();
  const [pracuji, setPracuji] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState<string | null>(null);
  /** Právě vymyšlené přihlašovací údaje - ukážou se jednou (22. 9. 2026). */
  const [udaje, setUdaje] = useState<{ studioId: string; login: string; heslo: string } | null>(null);
  const [chybaUctu, setChybaUctu] = useState<string | null>(null);

  async function vytvorUcet(studioId: string, noveHeslo: boolean) {
    if (noveHeslo && !window.confirm('Nastavit heslo zpátky na 1111?')) return;
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
      setChybaUctu(telo.error || 'Účet se nepodařilo založit.');
      return;
    }
    setUdaje({ studioId, login: telo.login, heslo: telo.heslo });
    router.refresh();
  }

  async function zrusUcet(studioId: string, ucetId: string) {
    if (!window.confirm('Zrušit účet tabule? Počítač u obrazovky se už nepřihlásí (běžící tabule poběží dál, dokud nevyměníte adresu).')) return;
    await fetch(`/api/admin/studia/${studioId}/tabule/ucet?ucet=${encodeURIComponent(ucetId)}`, { method: 'DELETE' }).catch(() => null);
    router.refresh();
  }

  async function akce(id: string, co: 'zapnout' | 'novy' | 'vypnout') {
    if (co === 'novy' && !window.confirm('Vyměnit adresu? Displej se starou adresou přestane fungovat a bude potřeba otevřít novou.')) return;
    if (co === 'vypnout' && !window.confirm('Vypnout tabuli? Displej ve studiu přestane fungovat.')) return;
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

  const datum = (iso: string) =>
    new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <section className="bg-surface border border-line rounded-card shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Tabule ve studiích</h2>
        <p className="text-sm text-muted m-0 mt-1 max-w-[80ch]">
          Dotykový displej ve studiu: dnešní program z kalendáře, poznámky a co ve studiu chybí. Adresu otevřete na
          displeji v prohlížeči přes celou obrazovku, nebo se na počítači u displeje přihlaste účtem tabule. Když někdo ťukne, že něco chybí, Bruno napíše
          Báře Šiblové.
        </p>
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
                      Otevřít tabuli ↗
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
                      {zkopirovano === s.id ? '✓ Zkopírováno' : 'Kopírovat adresu'}
                    </button>
                    <span className="ml-auto flex gap-3">
                      <button
                        type="button"
                        disabled={pracuji === s.id}
                        onClick={() => akce(s.id, 'novy')}
                        className="text-xs font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
                      >
                        Nová adresa
                      </button>
                      <button
                        type="button"
                        disabled={pracuji === s.id}
                        onClick={() => akce(s.id, 'vypnout')}
                        className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
                      >
                        Vypnout
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
                    Zapnout tabuli
                  </button>
                )}
              </div>

              {/* ÚČET POČÍTAČE U OBRAZOVKY (22. 9. 2026): jméno a heslo bez
                  e-mailu. Přihlásí se jím v Chromu a portál rovnou ukáže
                  tabuli tohohle studia. */}
              <div className="pl-6 flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">Účet tabule</span>
                  {s.ucty.filter((u) => u.aktivni).map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-2">
                      <span className="text-muted">jméno</span>
                      <span className="font-heading font-semibold text-ink">{u.email}</span>
                      <button
                        type="button"
                        disabled={pracuji === s.id}
                        onClick={() => void vytvorUcet(s.id, true)}
                        className="text-xs font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
                      >
                        Heslo na 1111
                      </button>
                      <button
                        type="button"
                        onClick={() => zrusUcet(s.id, u.id)}
                        className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer"
                      >
                        Zrušit
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
                      + Vytvořit účet pro obrazovku
                    </button>
                  )}
                </div>
                {udaje?.studioId === s.id && (
                  <div className="rounded-lg border border-brand-purple/40 bg-brand-purple/5 px-3 py-2 text-sm">
                    Přihlášení na počítači u obrazovky: jméno <strong className="font-heading">{udaje.login}</strong>, heslo{' '}
                    <strong className="font-heading tracking-wide">{udaje.heslo}</strong>.
                  </div>
                )}
                {chybaUctu && pracuji === null && <span className="text-sm text-danger">{chybaUctu}</span>}
              </div>

              {s.klic && (s.chybi.length > 0 || s.poznamky.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">Chybí</span>
                    {s.chybi.length === 0 ? (
                      <span className="text-sm text-muted">Nic.</span>
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
                            Doplněno
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">Poznámky</span>
                    {s.poznamky.length === 0 ? (
                      <span className="text-sm text-muted">Žádné.</span>
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
                            Odškrtnout
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
