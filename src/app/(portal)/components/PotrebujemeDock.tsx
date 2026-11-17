'use client';

import { useCallback, useEffect, useState } from 'react';
import { oznamPocetDoku, usePoctyDoku, usePravyDok } from './pravyDok';
import { ZalozkyDoku } from './ZalozkyDoku';
import { usePreklad } from './JazykProvider';

/**
 * CO JE POTŘEBA VE STUDIÍCH - třetí panel na pravé hraně (zadání 17. 11. 2026:
 * „potřebuju někde udělat takový seznam, co je potřeba nakoupit nebo udělat ve
 * studiích… chci to jak další to do list… další záložku za chat a úkoly").
 *
 * JE TO DRUHÝ TO-DO LIST, NE ČÁST CHATU. Chová se přesně jako Úkoly vedle:
 * řádek, zaškrtávátko, odškrtnuté spadne dolů. Žádné stavy, žádné pilulky -
 * kdo večer u pultu zjistí, že chybí mikrofon, napíše jednu větu a jde dál.
 *
 * KOUPIT / UDĚLAT je jen přepínač u psaní a značka u řádku, ne další seznam
 * („KOUPIT/UDĚLAT. JEDNA ZÁLOŽKA, DVA DRUHY").
 *
 * KDO CO VIDÍ, hlídá server (lib/pozadavkyStudii.ts): vedoucí pobočky svoje
 * studia, Ondřej s Peterem všechno. Kdo nemá právo, tomu se záložka vůbec
 * neukáže - viz PotrebujemePravo níž.
 *
 * ŽÁDNÉ CENY ANI DOKLADY (zadání: „ne, tohle je jen seznam").
 */

type Pozadavek = {
  id: string;
  studioId: string;
  studio: string;
  druh: 'KOUPIT' | 'UDELAT';
  text: string;
  specha: boolean;
  stav: 'NOVY' | 'ZARIZUJE_SE' | 'HOTOVO' | 'ZAMITNUTO';
  zadal: string | null;
  jeMuj: boolean;
  vyridil: string | null;
  createdAt: string;
};

type Studio = { id: string; name: string; shortName: string };

function jeHotovy(stav: Pozadavek['stav']): boolean {
  return stav === 'HOTOVO' || stav === 'ZAMITNUTO';
}

/** Značka druhu - košík pro koupit, klíč pro udělat. Tvar, ne jen barva. */
function IkonaDruhu({ druh }: { druh: Pozadavek['druh'] }) {
  const spolecne = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'w-4 h-4 shrink-0',
  };
  if (druh === 'KOUPIT') {
    return (
      <svg {...spolecne} aria-hidden="true">
        <path d="M4 5h2l2.2 9.5a1.6 1.6 0 0 0 1.6 1.2h7.1a1.6 1.6 0 0 0 1.6-1.2L20 8H6.5" />
        <circle cx="10" cy="19.5" r="1.3" />
        <circle cx="17.5" cy="19.5" r="1.3" />
      </svg>
    );
  }
  return (
    <svg {...spolecne} aria-hidden="true">
      <path d="M14.5 3.5a5 5 0 0 0-5.9 6.4L3.5 15v4h4l5.1-5.1a5 5 0 0 0 6.4-5.9l-2.9 2.9-2.6-.7-.7-2.6z" />
    </svg>
  );
}

export function KosikIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M4 5h2l2.2 9.5a1.6 1.6 0 0 0 1.6 1.2h7.1a1.6 1.6 0 0 0 1.6-1.2L20 8H6.5" />
      <circle cx="10" cy="19.5" r="1.3" />
      <circle cx="17.5" cy="19.5" r="1.3" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Má tenhle účet na seznam vůbec právo? Panel i záložka se bez toho
 * nevykreslí. Ptá se jednou za život stránky, odpověď je jeden boolean.
 */
export function usePravoNaPotreby(): boolean {
  const [smi, setSmi] = useState(false);
  useEffect(() => {
    let platne = true;
    fetch('/api/pozadavky/pristup')
      .then((r) => (r.ok ? r.json() : { smi: false }))
      .then((d) => {
        if (platne) setSmi(Boolean(d?.smi));
      })
      .catch(() => {
        // Seznam je doplnek - kdyz se pravo nenacte, zalozka proste neni.
      });
    return () => {
      platne = false;
    };
  }, []);
  return smi;
}

export function PotrebujemeDock() {
  const t = usePreklad();
  const [dok, otevriDok] = usePravyDok();
  const pocty = usePoctyDoku();
  const smi = usePravoNaPotreby();
  const expanded = dok === 'potrebujeme';

  const [data, setData] = useState<{ spravce: boolean; studia: Studio[]; pozadavky: Pozadavek[] } | null>(
    null,
  );
  const [chyba, setChyba] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hotove, setHotove] = useState(false);

  const [text, setText] = useState('');
  const [studioId, setStudioId] = useState('');
  const [druh, setDruh] = useState<Pozadavek['druh']>('KOUPIT');
  const [specha, setSpecha] = useState(false);
  /** Co uz clovek odskrtl - seznam se prekresli hned, server se dorovna potom. */
  const [prepnute, setPrepnute] = useState<Record<string, boolean>>({});

  const nacti = useCallback(async () => {
    try {
      const res = await fetch('/api/pozadavky');
      const odpoved = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(odpoved?.error ?? t('pozadavky.chybaNacteni'));
        return;
      }
      setChyba(null);
      setPrepnute({});
      const studia: Studio[] = Array.isArray(odpoved.studia) ? odpoved.studia : [];
      setData({
        spravce: Boolean(odpoved.spravce),
        studia,
        pozadavky: Array.isArray(odpoved.pozadavky) ? odpoved.pozadavky : [],
      });
      // Jedine studio se predvyplni - vedouci jedne pobocky at neklika
      // rozbalovatko s jedinou volbou.
      setStudioId((soucasne) => soucasne || (studia.length === 1 ? studia[0].id : ''));
    } catch {
      setChyba(t('pozadavky.chybaNacteni'));
    }
  }, [t]);

  // Nacita se, az kdyz je panel otevreny - jinak by kazda stranka portalu
  // tahala seznam, do ktereho se nikdo nekouka.
  useEffect(() => {
    if (smi && expanded) void nacti();
  }, [smi, expanded, nacti]);

  const vsechny = (data?.pozadavky ?? []).map((p) =>
    p.id in prepnute ? { ...p, stav: (prepnute[p.id] ? 'HOTOVO' : 'NOVY') as Pozadavek['stav'] } : p,
  );
  const otevrene = vsechny.filter((p) => !jeHotovy(p.stav));
  const uzavrene = vsechny.filter((p) => jeHotovy(p.stav));

  // Cislo u zalozky vidi i ostatni panely - viz pravyDok.ts.
  useEffect(() => {
    if (smi) oznamPocetDoku('potrebujeme', otevrene.length);
  }, [smi, otevrene.length]);

  async function pridej(e: React.FormEvent) {
    e.preventDefault();
    const veta = text.trim();
    if (!veta || !studioId || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/pozadavky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, druh, text: veta, specha }),
      });
      const odpoved = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(odpoved?.error ?? t('pozadavky.chybaUlozeni'));
        return;
      }
      setText('');
      setSpecha(false);
      await nacti();
    } finally {
      setBusy(false);
    }
  }

  /** Odškrtnutí se projeví hned, server se dorovná potom. */
  async function odskrtni(id: string, hotovo: boolean) {
    setPrepnute((c) => ({ ...c, [id]: hotovo }));
    setChyba(null);
    try {
      const res = await fetch(`/api/pozadavky/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav: hotovo ? 'HOTOVO' : 'NOVY' }),
      });
      if (!res.ok) throw new Error();
      await nacti();
    } catch {
      setPrepnute((c) => {
        const { [id]: _pryc, ...zbytek } = c;
        return zbytek;
      });
      setChyba(t('pozadavky.chybaUlozeni'));
    }
  }

  async function smaz(id: string) {
    try {
      await fetch(`/api/pozadavky/${id}`, { method: 'DELETE' });
    } finally {
      await nacti();
    }
  }

  if (!smi || !expanded) return null;

  const radek = (p: Pozadavek) => {
    const hotovy = jeHotovy(p.stav);
    const smiOdskrtnout = Boolean(data?.spravce) || p.jeMuj;
    return (
      <li key={p.id} className="flex items-start gap-1 py-1.5 group">
        {/* Větší cíl než samo zaškrtávátko - stejně jako u Úkolů. */}
        <label className="shrink-0 -ml-2 p-2 cursor-pointer rounded-lg hover:bg-field">
          <input
            type="checkbox"
            checked={hotovy}
            disabled={!smiOdskrtnout}
            onChange={() => void odskrtni(p.id, !hotovy)}
            aria-label={p.text}
            className="w-4 h-4 accent-[#6C4BF4] block disabled:opacity-40"
          />
        </label>
        <span className="flex-1 min-w-0">
          <span className="flex items-start gap-1.5">
            <span className={p.druh === 'KOUPIT' ? 'text-brand-purple mt-0.5' : 'text-status-progress mt-0.5'}>
              <IkonaDruhu druh={p.druh} />
            </span>
            <span
              className={`flex-1 min-w-0 text-sm font-body break-words ${
                hotovy ? 'text-muted line-through' : 'text-ink'
              }`}
            >
              {p.text}
            </span>
            {p.specha && !hotovy && (
              <span
                title={t('pozadavky.specha')}
                aria-label={t('pozadavky.specha')}
                role="img"
                className="text-danger shrink-0 mt-0.5"
              >
                <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
                  <circle cx="9" cy="9" r="7" fill="currentColor" />
                  <rect x="8.1" y="4.4" width="1.8" height="5.5" rx="0.9" className="fill-surface" />
                  <circle cx="9" cy="12.6" r="1.05" className="fill-surface" />
                </svg>
              </span>
            )}
          </span>
          <span className="block text-[11px] font-heading text-muted mt-0.5">
            {p.studio}
            {p.zadal ? ` · ${p.zadal}` : ''}
            {hotovy && p.vyridil ? ` · ${t('pozadavky.vyridil', { kdo: p.vyridil })}` : ''}
          </span>
        </span>
        {(data?.spravce || (p.jeMuj && p.stav === 'NOVY')) && (
          <button
            type="button"
            onClick={() => void smaz(p.id)}
            title={t('pozadavky.smazat')}
            aria-label={t('pozadavky.smazat')}
            className="shrink-0 text-xs text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity px-1"
          >
            ✕
          </button>
        )}
      </li>
    );
  };

  return (
    <aside className="fixed right-0 top-28 bottom-6 z-40 flex items-stretch">
      <button
        type="button"
        onClick={() => otevriDok(null)}
        title={t('dok.skrytPanel')}
        aria-label={t('dok.skrytPanel')}
        className="w-8 shrink-0 rounded-l-card border border-r-0 border-line bg-field text-muted hover:bg-brand-purple hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
      >
        <Chevron />
        <span className="text-[10px] font-heading font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          {t('obecne.skryt')}
        </span>
        <Chevron />
      </button>

      <div className="w-[360px] max-w-[86vw] bg-surface border border-r-0 border-line shadow-xl flex flex-col min-h-0">
        <ZalozkyDoku
          aktivni="potrebujeme"
          otevri={otevriDok}
          pocetUkolu={pocty.ukoly}
          neprectene={pocty.chat}
          maPotrebujeme
          pocetPotreb={otevrene.length}
        />

        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
          {(data?.studia.length ?? 0) > 0 && (
            <form onSubmit={pridej} className="flex flex-col gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('pozadavky.placeholder')}
                maxLength={300}
                className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
              />
              <div className="flex items-center gap-2">
                {/* KOUPIT / UDELAT je prepinac, ne dalsi seznam. */}
                <span className="flex rounded-lg border border-line overflow-hidden shrink-0">
                  {(['KOUPIT', 'UDELAT'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDruh(d)}
                      aria-pressed={druh === d}
                      className={`px-2.5 py-2 text-[11px] font-heading font-semibold ${
                        druh === d ? 'bg-brand-purple text-white' : 'bg-field text-muted'
                      }`}
                    >
                      {t(d === 'KOUPIT' ? 'pozadavky.druhKoupit' : 'pozadavky.druhUdelat')}
                    </button>
                  ))}
                </span>
                {(data?.studia.length ?? 0) > 1 && (
                  <select
                    value={studioId}
                    onChange={(e) => setStudioId(e.target.value)}
                    aria-label={t('pozadavky.studio')}
                    className="flex-1 min-w-0 rounded-lg border border-line bg-field px-2 py-2 text-ink font-heading text-xs outline-none focus:border-brand-purple"
                  >
                    <option value="">{t('pozadavky.vyberteStudio')}</option>
                    {data?.studia.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shortName || s.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setSpecha((v) => !v)}
                  aria-pressed={specha}
                  title={t('pozadavky.specha')}
                  className={`shrink-0 rounded-lg px-2.5 py-2 text-[11px] font-heading font-semibold border ${
                    specha ? 'border-danger bg-dangerTint text-danger' : 'border-line bg-field text-muted'
                  }`}
                >
                  {t('pozadavky.spechaZkratka')}
                </button>
                <button
                  type="submit"
                  disabled={busy || !text.trim() || !studioId}
                  className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50 shrink-0"
                >
                  {t('ukoly.pridat')}
                </button>
              </div>
            </form>
          )}

          {chyba && <p className="m-0 text-xs font-body text-danger">{chyba}</p>}

          {data === null ? (
            <p className="m-0 text-sm font-body text-muted">{t('pozadavky.nacitam')}</p>
          ) : (
            <>
              {otevrene.length === 0 && (
                <p className="m-0 text-sm font-body text-muted">{t('pozadavky.prazdno')}</p>
              )}
              <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
                {otevrene.map(radek)}
              </ul>

              {uzavrene.length > 0 && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setHotove((v) => !v)}
                    className="text-xs font-heading text-muted hover:text-ink text-left"
                  >
                    {hotove
                      ? t('pozadavky.skryjHotove')
                      : t('pozadavky.ukazHotove', { pocet: uzavrene.length })}
                  </button>
                  {hotove && (
                    <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
                      {uzavrene.map(radek)}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
