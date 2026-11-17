'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePreklad } from './JazykProvider';

/**
 * CO JE POTŘEBA VE STUDIÍCH - záložka chatu (zadání 17. 11. 2026: „tyhle
 * seznamy by mohly být jako další záložka v chatu, ať je to po ruce.
 * KOUPIT/UDĚLAT. JEDNA ZÁLOŽKA, DVA DRUHY").
 *
 * JEDNA ZÁLOŽKA, NE DVĚ. Koupit a udělat je jen přepínač u řádku - kdo
 * zapisuje, že v Brně I chybí mikrofon, nemá nejdřív přemýšlet, do které
 * záložky to patří. V seznamu je druh vidět na první pohled podle značky.
 *
 * ŽÁDNÉ CENY ANI DOKLADY (zadání: „ne, tohle je jen seznam"). Jakmile by se
 * tu začalo účtovat, přestal by to být seznam, který někdo večer u pultu
 * rychle doplní.
 *
 * KDO CO VIDÍ, hlídá server (lib/pozadavkyStudii.ts) - tahle komponenta jen
 * kreslí to, co dostane. Vedoucí pobočky dostane svoje studia, Ondřej
 * s Peterem všechno a navíc přehazují stavy.
 */

type Pozadavek = {
  id: string;
  studioId: string;
  studio: string;
  druh: 'KOUPIT' | 'UDELAT';
  text: string;
  popis: string | null;
  specha: boolean;
  stav: 'NOVY' | 'ZARIZUJE_SE' | 'HOTOVO' | 'ZAMITNUTO';
  zadal: string | null;
  jeMuj: boolean;
  vyridil: string | null;
  vyrizeniPoznamka: string | null;
  createdAt: string;
  vyrizenoAt: string | null;
};

type Studio = { id: string; name: string; shortName: string };

const KLIC_STAVU = {
  NOVY: 'pozadavky.stavNovy',
  ZARIZUJE_SE: 'pozadavky.stavZarizujeSe',
  HOTOVO: 'pozadavky.stavHotovo',
  ZAMITNUTO: 'pozadavky.stavZamitnuto',
} as const;

/** Barvy stavu. Zelená nese tmavý text - bílé písmo na zelenou nikdy. */
const TRIDA_STAVU = {
  NOVY: 'bg-tint text-brand-purple',
  ZARIZUJE_SE: 'bg-warnTint text-status-progress',
  HOTOVO: 'bg-okTint text-status-done',
  ZAMITNUTO: 'bg-field text-muted',
} as const;

const DALSI_STAV = {
  NOVY: 'ZARIZUJE_SE',
  ZARIZUJE_SE: 'HOTOVO',
  HOTOVO: 'NOVY',
  ZAMITNUTO: 'NOVY',
} as const;

function jeUzavreny(stav: Pozadavek['stav']): boolean {
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

export function PozadavkyVChatu() {
  const t = usePreklad();
  const [data, setData] = useState<{
    spravce: boolean;
    studia: Studio[];
    pozadavky: Pozadavek[];
  } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hotove, setHotove] = useState(false);

  // Nový požadavek
  const [text, setText] = useState('');
  const [studioId, setStudioId] = useState('');
  const [druh, setDruh] = useState<Pozadavek['druh']>('KOUPIT');
  const [specha, setSpecha] = useState(false);

  const nacti = useCallback(async () => {
    try {
      const res = await fetch('/api/pozadavky');
      const odpoved = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(odpoved?.error ?? t('pozadavky.chybaNacteni'));
        return;
      }
      setChyba(null);
      setData({
        spravce: Boolean(odpoved.spravce),
        studia: Array.isArray(odpoved.studia) ? odpoved.studia : [],
        pozadavky: Array.isArray(odpoved.pozadavky) ? odpoved.pozadavky : [],
      });
      // Studio se predvyplni, kdyz je jen jedno - vedouci jedne pobocky at
      // neklika rozbalovatko, ve kterem je jedina volba.
      setStudioId((soucasne) => {
        if (soucasne) return soucasne;
        const studia = Array.isArray(odpoved.studia) ? odpoved.studia : [];
        return studia.length === 1 ? studia[0].id : '';
      });
    } catch {
      setChyba(t('pozadavky.chybaNacteni'));
    }
  }, [t]);

  useEffect(() => {
    void nacti();
  }, [nacti]);

  async function pridej(e: React.FormEvent) {
    e.preventDefault();
    const popis = text.trim();
    if (!popis || !studioId || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/pozadavky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, druh, text: popis, specha }),
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

  async function uprav(id: string, zmena: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/pozadavky/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zmena),
      });
      if (!res.ok) {
        const odpoved = await res.json().catch(() => ({}));
        setChyba(odpoved?.error ?? t('pozadavky.chybaUlozeni'));
      }
      await nacti();
    } catch {
      await nacti();
    }
  }

  async function smaz(id: string) {
    try {
      await fetch(`/api/pozadavky/${id}`, { method: 'DELETE' });
    } finally {
      await nacti();
    }
  }

  if (chyba && !data) {
    return <p className="px-2 py-3 text-xs font-body text-muted">{chyba}</p>;
  }
  if (!data) {
    return <p className="px-2 py-3 text-xs font-body text-muted">{t('pozadavky.nacitam')}</p>;
  }

  const otevrene = data.pozadavky.filter((p) => !jeUzavreny(p.stav));
  const uzavrene = data.pozadavky.filter((p) => jeUzavreny(p.stav));

  function Radek({ p }: { p: Pozadavek }) {
    const smiMenitStav = data!.spravce;
    const smiSmazat = data!.spravce || (p.jeMuj && p.stav === 'NOVY');
    return (
      <li className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-2.5 py-2">
        <div className="flex items-start gap-2">
          <span className={p.druh === 'KOUPIT' ? 'text-brand-purple mt-0.5' : 'text-status-progress mt-0.5'}>
            <IkonaDruhu druh={p.druh} />
          </span>
          <span className="flex-1 min-w-0">
            <span
              className={`block text-sm font-body ${
                jeUzavreny(p.stav) ? 'text-muted line-through' : 'text-ink'
              }`}
            >
              {p.text}
            </span>
            <span className="block text-[11px] font-body text-muted">
              {p.studio}
              {p.zadal ? ` · ${p.zadal}` : ''}
              {p.vyridil ? ` · ${t('pozadavky.vyridil', { kdo: p.vyridil })}` : ''}
            </span>
            {p.popis && (
              <span className="block text-[11px] font-body text-muted whitespace-pre-wrap">
                {p.popis}
              </span>
            )}
          </span>
          {p.specha && !jeUzavreny(p.stav) && (
            <span
              title={t('pozadavky.specha')}
              aria-label={t('pozadavky.specha')}
              role="img"
              className="text-danger mt-0.5"
            >
              <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
                <circle cx="9" cy="9" r="7" fill="currentColor" />
                <rect x="8.1" y="4.4" width="1.8" height="5.5" rx="0.9" className="fill-surface" />
                <circle cx="9" cy="12.6" r="1.05" className="fill-surface" />
              </svg>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={!smiMenitStav}
            onClick={() => void uprav(p.id, { stav: DALSI_STAV[p.stav] })}
            title={smiMenitStav ? t('pozadavky.dalsiStav') : undefined}
            className={`rounded-pill px-2 py-0.5 text-[11px] font-heading font-semibold ${
              TRIDA_STAVU[p.stav]
            } ${smiMenitStav ? 'hover:opacity-80' : 'cursor-default'}`}
          >
            {t(KLIC_STAVU[p.stav])}
          </button>
          {smiMenitStav && p.stav !== 'ZAMITNUTO' && (
            <button
              type="button"
              onClick={() => void uprav(p.id, { stav: 'ZAMITNUTO' })}
              className="rounded-pill px-2 py-0.5 text-[11px] font-body text-muted hover:text-danger"
            >
              {t('pozadavky.zamitnout')}
            </button>
          )}
          {smiSmazat && (
            <button
              type="button"
              onClick={() => void smaz(p.id)}
              className="rounded-pill px-2 py-0.5 text-[11px] font-body text-muted hover:text-danger"
            >
              {t('pozadavky.smazat')}
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-1">
      {data.studia.length > 0 && (
        <form onSubmit={pridej} className="flex flex-col gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('pozadavky.placeholder')}
            maxLength={300}
            className="rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm font-body text-ink placeholder:text-muted"
          />
          <div className="flex items-center gap-1.5">
            {/* KOUPIT / UDELAT jako prepinac, ne dve zalozky (17. 11. 2026). */}
            <span className="flex rounded-lg border border-line overflow-hidden shrink-0">
              {(['KOUPIT', 'UDELAT'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDruh(d)}
                  aria-pressed={druh === d}
                  className={`px-2 py-1.5 text-[11px] font-heading font-semibold ${
                    druh === d ? 'bg-brand-purple text-white' : 'bg-field text-muted'
                  }`}
                >
                  {t(d === 'KOUPIT' ? 'pozadavky.druhKoupit' : 'pozadavky.druhUdelat')}
                </button>
              ))}
            </span>
            {data.studia.length > 1 && (
              <select
                value={studioId}
                onChange={(e) => setStudioId(e.target.value)}
                aria-label={t('pozadavky.studio')}
                className="flex-1 min-w-0 rounded-lg border border-line bg-field px-2 py-1.5 text-xs font-body text-ink"
              >
                <option value="">{t('pozadavky.vyberteStudio')}</option>
                {data.studia.map((s) => (
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
              className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-heading font-semibold border ${
                specha
                  ? 'border-danger bg-dangerTint text-danger'
                  : 'border-line bg-field text-muted'
              }`}
            >
              {t('pozadavky.spechaZkratka')}
            </button>
            <button
              type="submit"
              disabled={busy || !text.trim() || !studioId}
              className="shrink-0 bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {t('chat.pridat')}
            </button>
          </div>
        </form>
      )}

      {chyba && <p className="text-[11px] font-body text-danger">{chyba}</p>}

      {otevrene.length === 0 && (
        <p className="px-1 py-2 text-xs font-body text-muted">{t('pozadavky.prazdno')}</p>
      )}
      <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
        {otevrene.map((p) => (
          <Radek key={p.id} p={p} />
        ))}
      </ul>

      {uzavrene.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setHotove((v) => !v)}
            className="self-start text-[11px] font-body text-muted hover:text-ink"
          >
            {hotove
              ? t('pozadavky.skryjHotove')
              : t('pozadavky.ukazHotove', { pocet: uzavrene.length })}
          </button>
          {hotove && (
            <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
              {uzavrene.map((p) => (
                <Radek key={p.id} p={p} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
