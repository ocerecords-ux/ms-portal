'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';

/**
 * DOK DOTAZŮ PRO KLIENTA (zadání 12. 9. 2026: „dal bych pryč celé ty rychlé
 * volby na levé straně stránky i s tím vysouvacím menu a udělal bych stabilní
 * chat na pravé straně, jak to máme interně, kde by zůstávaly konverzace
 * k projektům, když se klient bude na něco doptávat").
 *
 * PROČ NE ROVNOU MS CHAT: klient do něj nepatří — jsou v něm kanály projektů,
 * skupiny a soukromé zprávy celého týmu. Tenhle dok vypadá stejně, ale mluví
 * jen s /api/dotazy, kde se u každého požadavku ověřuje, že projekt patří
 * firmě přihlášeného klienta. Je to úzká branka, ne otevřené dveře.
 *
 * Kanál vzniká až první odeslanou zprávou, takže u projektů, kde se nikdo na
 * nic nezeptal, nevznikají prázdné konverzace.
 */

type Projekt = {
  projektId: string;
  nazev: string;
  neprectene: number;
  posledniAt: string | null;
  zalozeno: boolean;
  uzavreno: boolean;
};

type Zprava = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
  authorPhotoUrl: string | null;
  mine: boolean;
};

const KLIC = 'ms-portal-dotazy-otevreno';
const UDALOST_OTEVRI = 'ms-portal-otevri-dotaz';
const OBNOVA_MS = 15000;

/** Otevře dok rovnou u tohohle projektu - používá tlačítko „Zeptat se". */
export function otevriDotazy(projektId: string) {
  window.dispatchEvent(new CustomEvent<string>(UDALOST_OTEVRI, { detail: projektId }));
}

function cas(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
}

export function DotazyDock() {
  const [otevreno, setOtevreno] = useState(false);
  const [projekty, setProjekty] = useState<Projekt[]>([]);
  const [vybrany, setVybrany] = useState<string | null>(null);
  const [zpravy, setZpravy] = useState<Zprava[]>([]);
  const [uzavreno, setUzavreno] = useState(false);
  const [text, setText] = useState('');
  const [odesilam, setOdesilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const konec = useRef<HTMLDivElement | null>(null);

  const nactiProjekty = useCallback(async () => {
    try {
      const res: Response = await fetch('/api/dotazy', { cache: 'no-store' });
      if (!res.ok) return;
      const data: { projekty?: Projekt[] } = await res.json().catch(() => ({}));
      setProjekty(Array.isArray(data.projekty) ? data.projekty : []);
    } catch {
      // nevadi, zkusi se za chvili znovu
    }
  }, []);

  const nactiZpravy = useCallback(async (projektId: string) => {
    try {
      const res: Response = await fetch(`/api/dotazy/${encodeURIComponent(projektId)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data: { zpravy?: Zprava[]; uzavreno?: boolean } = await res.json().catch(() => ({}));
      setZpravy(Array.isArray(data.zpravy) ? data.zpravy : []);
      setUzavreno(Boolean(data.uzavreno));
    } catch {
      // nevadi
    }
  }, []);

  // Stav doku si pamatuje prohlizec, at se po prekliku stranky neschova.
  useEffect(() => {
    try {
      setOtevreno(window.localStorage.getItem(KLIC) === '1');
    } catch {
      // soukrome okno - dok proste zacne zabaleny
    }
  }, []);

  useEffect(() => {
    void nactiProjekty();
    const timer = window.setInterval(() => {
      void nactiProjekty();
      if (vybrany) void nactiZpravy(vybrany);
    }, OBNOVA_MS);
    return () => window.clearInterval(timer);
  }, [nactiProjekty, nactiZpravy, vybrany]);

  // „Zeptat se" u projektu otevre dok rovnou v nem.
  useEffect(() => {
    function posluchac(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (!id) return;
      prepni(true);
      setVybrany(id);
      void nactiZpravy(id);
    }
    window.addEventListener(UDALOST_OTEVRI, posluchac);
    return () => window.removeEventListener(UDALOST_OTEVRI, posluchac);
  }, [nactiZpravy]);

  useEffect(() => {
    konec.current?.scrollIntoView({ block: 'end' });
  }, [zpravy.length, vybrany]);

  function prepni(nove: boolean) {
    setOtevreno(nove);
    try {
      window.localStorage.setItem(KLIC, nove ? '1' : '0');
    } catch {
      // nevadi
    }
  }

  function otevriProjekt(p: Projekt) {
    setVybrany(p.projektId);
    setZpravy([]);
    setChyba(null);
    void nactiZpravy(p.projektId);
    // Otevrenim je precteno - cislo u poutka ma zmizet hned, ne za patnact vterin.
    setProjekty((soucasne) =>
      soucasne.map((x) => (x.projektId === p.projektId ? { ...x, neprectene: 0 } : x)),
    );
  }

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    const telo = text.trim();
    const projekt = projekty.find((p) => p.projektId === vybrany);
    if (!telo || !projekt || odesilam) return;
    setOdesilam(true);
    setChyba(null);

    // Zprava je v okne hned, at se necekaa na server (stejne jako v MS chatu).
    const docasna: Zprava = {
      id: `docasna-${Date.now()}`,
      body: telo,
      createdAt: new Date().toISOString(),
      authorLabel: 'Já',
      authorPhotoUrl: null,
      mine: true,
    };
    setText('');
    setZpravy((soucasne) => [...soucasne, docasna]);

    try {
      const res: Response = await fetch(`/api/dotazy/${encodeURIComponent(projekt.projektId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: telo, projectName: projekt.nazev }),
      });
      const data: { zpravy?: Zprava[]; uzavreno?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Dotaz se nepodařilo odeslat.');
      setZpravy(Array.isArray(data.zpravy) ? data.zpravy : []);
      setUzavreno(Boolean(data.uzavreno));
      void nactiProjekty();
    } catch (err) {
      setZpravy((soucasne) => soucasne.filter((z) => z.id !== docasna.id));
      setText((t) => (t ? t : telo));
      setChyba(err instanceof Error ? err.message : 'Dotaz se nepodařilo odeslat.');
    } finally {
      setOdesilam(false);
    }
  }

  const neprectene = projekty.reduce((soucet, p) => soucet + p.neprectene, 0);
  const vybranyProjekt = projekty.find((p) => p.projektId === vybrany) ?? null;

  // --- Zabaleny dok: poutko na hrane ---------------------------------------
  if (!otevreno) {
    return (
      <button
        type="button"
        onClick={() => prepni(true)}
        title="Dotazy k projektům"
        aria-label="Dotazy k projektům"
        className="fixed right-0 top-28 z-40 flex flex-col items-center gap-2.5 bg-brand-purple hover:bg-brand-purpleDeep rounded-l-card shadow-lg px-2.5 py-3 text-brand-green transition-colors"
      >
        <Sipka />
        <span className="relative">
          <IkonaDotazu />
          {neprectene > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-4 text-center">
              {neprectene}
            </span>
          )}
        </span>
        <span className="text-[10px] font-heading font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          Dotazy
        </span>
      </button>
    );
  }

  // --- Rozbaleny dok -------------------------------------------------------
  return (
    <aside className="fixed right-0 top-28 bottom-6 z-40 flex items-stretch">
      {/* Siroky pruh na zavreni, stejne jako u interniho doku - do male sipky
          se spatne trefuje. */}
      <button
        type="button"
        onClick={() => prepni(false)}
        title="Skrýt dotazy"
        aria-label="Skrýt dotazy"
        className="w-8 shrink-0 rounded-l-card border border-r-0 border-line bg-field text-muted hover:bg-brand-purple hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
      >
        <SipkaVpravo />
        <span className="text-[10px] font-heading font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          Skrýt
        </span>
        <SipkaVpravo />
      </button>

      <div className="w-[720px] max-w-[96vw] h-full bg-surface border border-r-0 border-line shadow-xl flex flex-col overflow-hidden">
        <div className="bg-brand-purple text-brand-green px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">Dotazy k projektům</h2>
          <span className="text-[11px] font-body text-white/70">Odpovídáme v pracovní době</span>
        </div>

        {chyba && <p className="text-xs text-danger bg-dangerTint px-4 py-2 m-0">{chyba}</p>}

        <div className="flex-1 min-h-0 flex">
          {/* Seznam projektu; na uzkem okne ustoupi otevrenemu rozhovoru. */}
          <div
            className={`w-[240px] shrink-0 border-r border-line bg-paper flex-col min-h-0 ${
              vybrany ? 'hidden sm:flex' : 'flex'
            }`}
          >
            <div className="px-3 pt-2.5 pb-1">
              <span className="font-heading font-semibold text-[11px] uppercase tracking-[0.14em] text-muted">
                Vaše projekty
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
              {projekty.length === 0 && (
                <p className="text-sm font-body text-muted m-0 px-1">Zatím tu nemáte žádný rozpracovaný projekt.</p>
              )}
              {projekty.map((p) => (
                <button
                  key={p.projektId}
                  type="button"
                  onClick={() => otevriProjekt(p)}
                  className={`text-left rounded-lg px-2.5 py-2 transition-colors flex items-start gap-2 ${
                    p.projektId === vybrany ? 'bg-tint' : 'hover:bg-field'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-sm text-ink">{p.nazev}</span>
                    <span className="block text-[11px] font-body text-muted">
                      {p.uzavreno
                        ? 'Uzavřeno'
                        : p.zalozeno
                          ? p.posledniAt
                            ? `Naposledy ${cas(p.posledniAt)}`
                            : 'Rozepsáno'
                          : 'Zatím bez dotazu'}
                    </span>
                  </span>
                  {p.neprectene > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-[18px] text-center">
                      {p.neprectene}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Samotny rozhovor */}
          <div className={`flex-1 min-w-0 flex-col ${vybrany ? 'flex' : 'hidden sm:flex'}`}>
            {!vybranyProjekt ? (
              <p className="m-auto text-sm font-body text-muted px-6 text-center">
                Vyberte vlevo projekt. Co sem napíšete, dorazí rovnou lidem, kteří na něm dělají.
              </p>
            ) : (
              <>
                <div className="px-4 py-2.5 border-b border-line bg-surface flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setVybrany(null)}
                    title="Zpět na seznam"
                    className="sm:hidden text-muted hover:text-brand-purple"
                  >
                    <SipkaVlevo />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading font-semibold text-sm text-ink leading-tight break-words">
                      {vybranyProjekt.nazev}
                    </span>
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                  {zpravy.length === 0 && (
                    <p className="text-sm font-body text-muted m-0">
                      Na co se potřebujete zeptat? Napište to sem — držíme to u projektu, takže se to
                      neztratí v mailu.
                    </p>
                  )}
                  {zpravy.map((z) => (
                    <div key={z.id} className="flex items-start gap-2">
                      <Avatar label={z.mine ? 'Já' : z.authorLabel} photoUrl={z.authorPhotoUrl} size={28} />
                      <div className="min-w-0">
                        <span className="flex items-baseline gap-2">
                          <span className="font-heading font-semibold text-xs text-ink">
                            {z.mine ? 'Já' : z.authorLabel}
                          </span>
                          <span className="text-[11px] font-body text-muted tabular-nums">{cas(z.createdAt)}</span>
                        </span>
                        <p
                          className={`mt-0.5 m-0 rounded-card px-3 py-2 text-sm font-body whitespace-pre-wrap break-words ${
                            z.mine ? 'bg-brand-purple text-white' : 'bg-field text-ink'
                          }`}
                        >
                          {z.body}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={konec} />
                </div>

                {uzavreno ? (
                  <p className="text-xs font-body text-muted border-t border-line px-4 py-3 m-0">
                    Projekt je uzavřený, takže sem už psát nejde. Historie zůstává.
                  </p>
                ) : (
                  <form onSubmit={odesli} className="border-t border-line p-3 flex items-end gap-2 shrink-0">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void odesli(e as unknown as React.FormEvent);
                        }
                      }}
                      rows={2}
                      placeholder="Napište dotaz… (Enter odešle, Shift+Enter nový řádek)"
                      className="flex-1 min-w-0 resize-none rounded-card border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
                    />
                    <button
                      type="submit"
                      disabled={odesilam || !text.trim()}
                      className="shrink-0 rounded-lg bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-2.5 disabled:opacity-40"
                    >
                      {odesilam ? 'Odesílám…' : 'Poslat'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Sipka() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function SipkaVpravo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function SipkaVlevo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function IkonaDotazu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <path d="M9.8 9.4a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 2.3-2.2 2.3" />
      <path d="M12 15.6h.01" />
    </svg>
  );
}
