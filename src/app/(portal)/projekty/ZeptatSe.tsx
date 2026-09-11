'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * „Zeptat se" u projektu v klientské sekci (zadání 11. 9. 2026).
 *
 * Klient nevidí MS chat a ani ho vidět nemá. Tohle je jedno okno k jednomu
 * projektu: co sem napíše, naskočí nám v MS chatu jako konverzace, ve které
 * sedí lidé se zaškrtnutým „Dostává dotazy klientů". Odpovědi vidí klient
 * tady, takže se nemusí přepínat do mailu.
 *
 * Kanál vzniká až prvním odeslaným dotazem - u projektů, kde se nikdo na nic
 * nezeptal, nevzniká prázdná konverzace.
 */

type Zprava = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
  authorPhotoUrl: string | null;
  mine: boolean;
};

const OBNOVA_MS = 15000;

function cas(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

export function ZeptatSe({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [otevreno, setOtevreno] = useState(false);
  const [zpravy, setZpravy] = useState<Zprava[]>([]);
  const [nacitam, setNacitam] = useState(false);
  const [uzavreno, setUzavreno] = useState(false);
  const [text, setText] = useState('');
  const [odesilam, setOdesilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const konec = useRef<HTMLDivElement | null>(null);

  const nacti = useCallback(
    async (tiche = false) => {
      if (!tiche) setNacitam(true);
      try {
        const res = await fetch(`/api/dotazy/${encodeURIComponent(projectId)}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setZpravy(Array.isArray(data?.zpravy) ? data.zpravy : []);
        setUzavreno(Boolean(data?.uzavreno));
      } catch {
        // nevadi, zkusi se znovu
      } finally {
        if (!tiche) setNacitam(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!otevreno) return;
    void nacti();
    const timer = setInterval(() => void nacti(true), OBNOVA_MS);
    return () => clearInterval(timer);
  }, [otevreno, nacti]);

  useEffect(() => {
    if (otevreno) konec.current?.scrollIntoView({ block: 'end' });
  }, [zpravy, otevreno]);

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    const hodnota = text.trim();
    if (!hodnota || odesilam) return;
    setOdesilam(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/dotazy/${encodeURIComponent(projectId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: hodnota, projectName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Dotaz se nepodařilo odeslat.');
        return;
      }
      setText('');
      setZpravy(Array.isArray(data?.zpravy) ? data.zpravy : []);
      setUzavreno(Boolean(data?.uzavreno));
    } catch {
      setChyba('Dotaz se nepodařilo odeslat.');
    } finally {
      setOdesilam(false);
    }
  }

  if (!otevreno) {
    return (
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="border border-brand-purple text-brand-purple font-heading font-semibold text-xs rounded-lg px-3 py-1.5 hover:bg-tint transition-colors whitespace-nowrap"
      >
        Zeptat se
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOtevreno(false)}
        className="border border-line text-muted font-heading font-semibold text-xs rounded-lg px-3 py-1.5 whitespace-nowrap"
      >
        Zavřít
      </button>

      {/* Okno pres obsah stranky - v radku tabulky by na konverzaci nebylo
          misto a rozjizdela by sloupce. */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 px-3 py-6">
        <div className="w-full max-w-[560px] max-h-[82vh] bg-surface rounded-card border border-line shadow-xl flex flex-col overflow-hidden">
          <div className="bg-brand-purple text-brand-green px-5 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">Zeptat se</h2>
              <p className="text-xs font-body text-white/80 m-0 mt-0.5 truncate">{projectName}</p>
            </div>
            <button
              type="button"
              onClick={() => setOtevreno(false)}
              aria-label="Zavřít"
              className="text-brand-green/90 hover:text-white text-lg leading-none px-1"
            >
              ×
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3 bg-surfaceSoft">
            {zpravy.length === 0 ? (
              <p className="text-sm font-body text-muted m-0">
                {nacitam
                  ? 'Načítám…'
                  : 'Napište, co potřebujete vědět. Ozveme se vám sem — odpověď uvidíte na tomhle místě.'}
              </p>
            ) : (
              zpravy.map((z) => (
                <div key={z.id} className={`flex flex-col ${z.mine ? 'items-end' : 'items-start'}`}>
                  <span className="text-[11px] font-heading text-muted mb-0.5">
                    {z.mine ? 'Vy' : z.authorLabel} · {cas(z.createdAt)}
                  </span>
                  <p
                    className={`m-0 rounded-card px-3 py-2 text-sm font-body whitespace-pre-wrap break-words shadow-sm max-w-[85%] ${
                      z.mine ? 'bg-brand-purple text-white' : 'bg-surface border border-line text-ink'
                    }`}
                  >
                    {z.body}
                  </p>
                </div>
              ))
            )}
            <div ref={konec} />
          </div>

          {chyba && <p className="text-xs text-danger bg-dangerTint px-4 py-2 m-0">{chyba}</p>}

          {uzavreno ? (
            <p className="text-sm font-body text-muted m-0 px-4 py-4 border-t border-line">
              Projekt je dokončený, takže se sem už psát nedá. Kdybyste potřebovali cokoliv dalšího,
              napište nám prosím e-mailem.
            </p>
          ) : (
            <form onSubmit={odesli} className="border-t border-line p-3 flex flex-col gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Váš dotaz k projektu…"
                className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={odesilam || !text.trim()}
                  className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
                >
                  {odesilam ? 'Odesílám…' : 'Odeslat dotaz'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
