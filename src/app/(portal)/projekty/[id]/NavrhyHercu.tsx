'use client';

import { useState } from 'react';
import { VyberHerce, type Herec } from '../VyberHerce';

/**
 * NÁVRHY HERCŮ (zadání 22. 10. 2026: „chtěl bych mít někde ještě u projektu
 * možnost přidat mé návrhy herců. Nějaká pole 1. 2. 3., ale aby se to
 * nemotalo do herců u projektu. Muselo by to být nějaké šedé třeba, aby bylo
 * poznat, že jde o návrhy").
 *
 * SEDÍ POD OBSAZENÍM, ALE NENÍ TO ONO. Obsazení jsou fialové bubliny a tisknou
 * se z něj rodné listy, smlouvy i honoráře; návrhy jsou šedý rámeček
 * s čárkovaným okrajem a nejdou nikam dál - ani klientovi, ani herci.
 * Rozdíl musí být vidět koutkem oka, proto ta barva.
 *
 * „DO OBSAZENÍ" překlopí návrh mezi herce projektu a ze seznamu návrhů ho
 * smaže. Herce to jen předvyplní do formuláře - uloží se s ním, až se projekt
 * uloží; proto ta věta pod seznamem, ať to nikdo nezavře mezitím.
 *
 * Popisky jsou psané rovnou tady, ne přes `lib/jazyk.ts`: ten má rozdělanou
 * práci překladová dávka. Až bude volný, klíče se přesunou.
 */

export type NavrhHerce = {
  id: string;
  poradi: number;
  userId: string | null;
  jmeno: string | null;
  poznamka: string | null;
  autorJmeno: string | null;
  user: { name: string | null; email: string } | null;
};

const TEXTY = {
  cs: {
    nadpis: 'Návrhy herců',
    vysvetlivka: 'jen pro nás — do obsazení se nepočítají',
    prazdno: 'Zatím žádné — sem si můžeš odložit, koho zvažuješ.',
    pridat: '+ Přidat návrh',
    doObsazeni: 'Do obsazení',
    uzObsazen: 'už v obsazení',
    smazat: '✕',
    hotovo: 'Přidáno mezi herce — nezapomeň projekt uložit.',
    jmenoRucne: 'Nebo jméno, kdo u nás účet nemá',
    poznamka: 'Poznámka (nepovinná)',
    ulozit: 'Uložit',
    zrusit: 'Zrušit',
    chyba: 'Nepodařilo se to uložit.',
  },
  en: {
    nadpis: 'Suggested actors',
    vysvetlivka: 'for us only — not part of the cast',
    prazdno: 'None yet - a place to park who you are considering.',
    pridat: '+ Add a suggestion',
    doObsazeni: 'Add to cast',
    uzObsazen: 'already cast',
    smazat: '✕',
    hotovo: 'Added to the cast - remember to save the project.',
    jmenoRucne: 'Or a name of someone without an account',
    poznamka: 'Note (optional)',
    ulozit: 'Save',
    zrusit: 'Cancel',
    chyba: 'Saving failed.',
  },
};

export function NavrhyHercu({
  caflouProjectId,
  herci,
  pocatecni,
  obsazeni,
  onDoObsazeni,
  jazyk,
}: {
  caflouProjectId: string;
  /** Herci s účtem - z nich se vybírá, aby šel návrh překlopit do obsazení. */
  herci: Herec[];
  pocatecni: NavrhHerce[];
  /** ID herců, kteří už v obsazení jsou - u nich se „Do obsazení" nenabízí. */
  obsazeni: string[];
  onDoObsazeni: (userId: string) => void;
  jazyk: string;
}) {
  const t = TEXTY[jazyk === 'en' ? 'en' : 'cs'];
  const [navrhy, setNavrhy] = useState<NavrhHerce[]>(pocatecni);
  const [pridavam, setPridavam] = useState(false);
  const [novyUserId, setNovyUserId] = useState('');
  const [noveJmeno, setNoveJmeno] = useState('');
  const [novaPoznamka, setNovaPoznamka] = useState('');
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);

  const zaklad = `/api/projekty/${encodeURIComponent(caflouProjectId)}/navrhy-hercu`;

  async function nacti() {
    try {
      const res = await fetch(zaklad, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { navrhy?: NavrhHerce[] };
      if (Array.isArray(data.navrhy)) setNavrhy(data.navrhy);
    } catch {
      // Seznam zustane, jaky byl.
    }
  }

  async function pridej() {
    if (pracuje) return;
    if (!novyUserId && !noveJmeno.trim()) return;
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(zaklad, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: novyUserId || null,
          jmeno: novyUserId ? null : noveJmeno.trim() || null,
          poznamka: novaPoznamka.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || t.chyba);
        return;
      }
      setNovyUserId('');
      setNoveJmeno('');
      setNovaPoznamka('');
      setPridavam(false);
      await nacti();
    } catch {
      setChyba(t.chyba);
    } finally {
      setPracuje(false);
    }
  }

  async function smaz(id: string) {
    setNavrhy((n) => n.filter((x) => x.id !== id));
    await fetch(`${zaklad}/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
  }

  async function preklop(navrh: NavrhHerce) {
    if (!navrh.userId) return;
    onDoObsazeni(navrh.userId);
    setHlaska(t.hotovo);
    await smaz(navrh.id);
  }

  const jmenoNavrhu = (n: NavrhHerce) =>
    n.user ? n.user.name || n.user.email : n.jmeno || '—';

  return (
    /* Šedý rámeček s čárkovaným okrajem - viz komentář nahoře. */
    <div className="mt-3 rounded-xl border border-dashed border-line bg-field/40 px-3.5 py-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          {t.nadpis}
        </span>
        <span className="text-[11px] font-body text-muted">{t.vysvetlivka}</span>
      </div>

      {navrhy.length === 0 && !pridavam && (
        <p className="text-xs font-body text-muted italic m-0">{t.prazdno}</p>
      )}

      {navrhy.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col">
          {navrhy.map((n, i) => (
            <li
              key={n.id}
              className="flex items-center gap-2.5 py-1.5 border-t border-line first:border-t-0"
            >
              <span className="shrink-0 w-[22px] h-[22px] rounded-full bg-surface-soft text-muted text-[11px] font-heading font-bold grid place-items-center">
                {i + 1}.
              </span>
              <span className="font-heading font-semibold text-sm text-ink/80 truncate">
                {jmenoNavrhu(n)}
              </span>
              {n.poznamka && (
                <span className="text-xs font-body text-muted truncate">· {n.poznamka}</span>
              )}
              <span className="ml-auto shrink-0 flex items-center gap-2.5">
                {n.userId && !obsazeni.includes(n.userId) && (
                  <button
                    type="button"
                    onClick={() => void preklop(n)}
                    className="text-[11px] font-heading font-semibold text-brand-purple"
                  >
                    {t.doObsazeni}
                  </button>
                )}
                {n.userId && obsazeni.includes(n.userId) && (
                  <span className="text-[11px] font-body text-muted">{t.uzObsazen}</span>
                )}
                <button
                  type="button"
                  onClick={() => void smaz(n.id)}
                  aria-label={t.smazat}
                  className="text-[11px] font-heading font-semibold text-muted hover:text-danger"
                >
                  {t.smazat}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {hlaska && <p className="text-[11px] font-body text-brand-purple m-0">{hlaska}</p>}

      {pridavam ? (
        <div className="flex flex-col gap-2 pt-1">
          <VyberHerce herci={herci} hodnota={novyUserId} onZmena={(id) => setNovyUserId(id)} />
          {!novyUserId && (
            <input
              value={noveJmeno}
              onChange={(e) => setNoveJmeno(e.target.value)}
              placeholder={t.jmenoRucne}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
            />
          )}
          <input
            value={novaPoznamka}
            onChange={(e) => setNovaPoznamka(e.target.value)}
            placeholder={t.poznamka}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
          />
          {chyba && <p className="text-xs font-body text-danger m-0">{chyba}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void pridej()}
              disabled={pracuje || (!novyUserId && !noveJmeno.trim())}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3.5 py-1.5 border-0 cursor-pointer disabled:opacity-50"
            >
              {t.ulozit}
            </button>
            <button
              type="button"
              onClick={() => {
                setPridavam(false);
                setChyba(null);
                setNovyUserId('');
                setNoveJmeno('');
                setNovaPoznamka('');
              }}
              className="text-xs font-heading font-semibold text-muted"
            >
              {t.zrusit}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setPridavam(true);
            setHlaska(null);
          }}
          className="self-start rounded-lg border border-dashed border-line text-muted hover:text-brand-purple hover:border-brand-purple font-heading font-semibold text-[11px] px-3 py-1.5 transition-colors"
        >
          {t.pridat}
        </button>
      )}
    </div>
  );
}
