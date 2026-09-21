'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type StudioTabule = {
  id: string;
  nazev: string;
  barva: string;
  klic: string | null;
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
          displeji v prohlížeči přes celou obrazovku - nepřihlašuje se. Když někdo ťukne, že něco chybí, Bruno napíše
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
