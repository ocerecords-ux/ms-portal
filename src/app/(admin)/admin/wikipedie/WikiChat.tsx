'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Chat nad konceptem (zadání 22. 9. 2026: „budu vzpomínat na minulost a věci,
 * které by tam na wiki mohly být, a on to bude formulovat a vkládat").
 *
 * Napsaný kus textu se do konceptu vloží AŽ NA KLIKNUTÍ - portál sám do
 * článku nic nepíše.
 */

type Zprava = { id: string; role: string; text: string; kdy: string };

const pole =
  'w-full rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple';
const tlacitko =
  'bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60';
const tlacitko2 =
  'font-heading font-semibold text-sm rounded-lg border border-line px-3 py-1.5 text-ink bg-transparent cursor-pointer hover:border-brand-purple transition-colors';

/** Text bez bloku wikitextu - ten se ukazuje zvlášť. */
function rozdel(text: string): { rec: string; navrh: string | null } {
  const m = text.match(/```(?:wikitext|wiki)?\s*\n([\s\S]*?)```/);
  if (!m) return { rec: text, navrh: null };
  return { rec: text.replace(m[0], '').trim(), navrh: m[1].trim() };
}

export function WikiChat({
  pripraveno,
  onVlozit,
}: {
  /** Koncept musí existovat (uložit), jinak nemá chat kam psát. */
  pripraveno: boolean;
  onVlozit: (wikitext: string, nahradit: boolean) => void;
}) {
  const [zpravy, setZpravy] = useState<Zprava[]>([]);
  const [text, setText] = useState('');
  const [pise, setPise] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [nacteno, setNacteno] = useState(false);
  const konec = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/wikipedie/chat');
        const data = (await res.json().catch(() => ({}))) as { zpravy?: Zprava[] };
        setZpravy(data.zpravy ?? []);
      } finally {
        setNacteno(true);
      }
    })();
  }, []);

  useEffect(() => {
    konec.current?.scrollIntoView({ block: 'nearest' });
  }, [zpravy.length, pise]);

  async function posli() {
    const zprava = text.trim();
    if (!zprava || pise) return;
    setPise(true);
    setChyba(null);
    setText('');
    try {
      const res = await fetch('/api/admin/wikipedie/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zprava }),
      });
      const data = (await res.json().catch(() => ({}))) as { moje?: Zprava; odpoved?: Zprava; error?: string };
      if (data.moje) setZpravy((s) => [...s, data.moje!]);
      if (!res.ok || !data.odpoved) {
        setChyba(data.error || 'Odpověď se nepodařilo získat.');
        return;
      }
      setZpravy((s) => [...s, data.odpoved!]);
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
    } finally {
      setPise(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div>
        <h2 className="font-heading font-semibold text-base text-ink m-0">Vzpomínání</h2>
        <p className="text-sm font-body text-muted m-0 mt-1 max-w-[80ch]">
          Vyprávějte, co jste zažil a na co si vzpomenete. Pomocník se doptá na podrobnosti a hlavně na zdroje,
          a když bude látky dost, napíše hotový kus wikitextu. Do konceptu ho vloží až vaše kliknutí.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-field/40 p-3 max-h-[420px] overflow-y-auto flex flex-col gap-3">
        {!nacteno && <p className="text-sm font-body text-muted m-0">Načítám…</p>}
        {nacteno && zpravy.length === 0 && (
          <p className="text-sm font-body text-muted m-0">
            Zatím nic. Zkuste třeba: „V roce 2014 jsem začal režírovat audioknihy pro…“
          </p>
        )}
        {zpravy.map((z) => {
          const { rec, navrh } = z.role === 'bot' ? rozdel(z.text) : { rec: z.text, navrh: null };
          return (
            <div key={z.id} className={`flex flex-col gap-2 ${z.role === 'ja' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-card px-3 py-2 text-sm font-body whitespace-pre-wrap ${
                  z.role === 'ja' ? 'bg-brand-purple text-white' : 'bg-surface border border-line text-ink'
                }`}
              >
                {rec || '…'}
              </div>
              {navrh && (
                <div className="w-full rounded-card border border-brand-purple/60 bg-surface p-3 flex flex-col gap-2">
                  <pre className="m-0 text-[12px] leading-relaxed font-mono text-ink whitespace-pre-wrap">{navrh}</pre>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" className={tlacitko2} onClick={() => onVlozit(navrh, false)}>
                      Přidat do konceptu
                    </button>
                    <button type="button" className={tlacitko2} onClick={() => onVlozit(navrh, true)}>
                      Nahradit koncept
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {pise && <p className="text-sm font-body text-muted m-0">Píše…</p>}
        <div ref={konec} />
      </div>

      {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}
      {!pripraveno && (
        <p className="text-sm font-body text-muted m-0">Nejdřív koncept uložte — chat se váže k němu.</p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void posli();
          }}
          rows={2}
          placeholder="Na co si vzpomínáte? (Cmd+Enter odešle)"
          disabled={!pripraveno}
          className={`${pole} resize-y`}
        />
        <button type="button" onClick={posli} disabled={pise || !text.trim() || !pripraveno} className={tlacitko}>
          {pise ? 'Posílám…' : 'Poslat'}
        </button>
      </div>
    </div>
  );
}
