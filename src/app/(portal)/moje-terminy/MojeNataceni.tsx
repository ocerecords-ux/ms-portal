'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad, useJazyk } from '../components/JazykProvider';
import { kodJazyka, formatDatum } from '@/lib/jazyk';
import { klicFrekvenci } from './ProbehlaNataceni';

/**
 * MOJE NATÁČENÍ + PŘEBOOKOVÁNÍ (zadání 19. 9. 2026: „když je vše s hercem
 * naplánované, aby viděl své termíny v portálu, když se přihlásí. Zároveň aby
 * měl možnost si i nějaký termín přebookovat sám… jakmile to bude mimo datum,
 * tak to půjde, ale musí mu tam vyskočit hláška, že to musíme potvrdit").
 */
export type Nataceni = {
  id: string;
  projekt: string;
  start: string;
  end: string;
  mesto: string;
  /** Přesné studio („Brno I") - herec musí vědět, kam v ten den jde. */
  studio: string;
  /** Potvrzeno produkcí (jinak herec vybral a čeká na nás). */
  potvrzeno: boolean;
  timezone: string;
  /** Čekající žádost o přesun za termín odevzdání. */
  zadost: { start: string; end: string } | null;
};

type Misto = { studioId: string; start: string; end: string; poTerminu: boolean };

export function MojeNataceni({ terminy }: { terminy: Nataceni[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const kod = kodJazyka(jazyk);
  const router = useRouter();
  const [otevreny, setOtevreny] = useState<string | null>(null);
  const [mista, setMista] = useState<Misto[] | null>(null);
  const [limit, setLimit] = useState<string | null>(null);
  const [nacita, setNacita] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** Místo po termínu odevzdání, u kterého se čeká na souhlas s hláškou. */
  const [potvrdit, setPotvrdit] = useState<{ slotId: string; misto: Misto } | null>(null);

  const cas = (iso: string, tz: string) =>
    new Intl.DateTimeFormat(kod, { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(iso),
    );
  const datum = (d: string) => formatDatum(jazyk, new Date(`${d}T12:00:00Z`));

  async function otevri(id: string) {
    if (otevreny === id) {
      setOtevreny(null);
      return;
    }
    setOtevreny(id);
    setMista(null);
    setChyba(null);
    setInfo(null);
    setNacita(true);
    try {
      const res = await fetch(`/api/moje-terminy/prebook?slotId=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('mojeTerminy.chybaNacteni'));
        return;
      }
      setMista(data.mista);
      setLimit(data.limit);
    } finally {
      setNacita(false);
    }
  }

  async function presun(slotId: string, m: Misto, souhlas = false) {
    if (m.poTerminu && !souhlas) {
      setPotvrdit({ slotId, misto: m });
      return;
    }
    setPotvrdit(null);
    setNacita(true);
    setChyba(null);
    try {
      const res = await fetch('/api/moje-terminy/prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, studioId: m.studioId, start: m.start, end: m.end, souhlasPosun: souhlas }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('mojeTerminy.chybaPresun'));
        return;
      }
      setOtevreny(null);
      setInfo(t(data.cekaNaPotvrzeni ? 'mojeTerminy.zadostPrijata' : 'mojeTerminy.presunuto'));
      router.refresh();
    } finally {
      setNacita(false);
    }
  }

  async function zrusZadost(slotId: string) {
    await fetch(`/api/moje-terminy/prebook?slotId=${encodeURIComponent(slotId)}`, { method: 'DELETE' });
    router.refresh();
  }

  /** Pondělí týdne „YYYY-MM-DD" (v Praze). */
  function pondeli(iso: string, tz: string): string {
    const den = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));
    const d = new Date(`${den}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  function popisTydne(po: string): string {
    const od = new Date(`${po}T12:00:00Z`);
    const ne = new Date(od);
    ne.setUTCDate(ne.getUTCDate() + 6);
    const f = (d: Date) => new Intl.DateTimeFormat(kod, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(d);
    const tento = pondeli(new Date().toISOString(), 'Europe/Prague');
    const pristi = new Date(`${tento}T12:00:00Z`);
    pristi.setUTCDate(pristi.getUTCDate() + 7);
    const nazev = t(
      po === tento
        ? 'mojeTerminy.tentoTyden'
        : po === pristi.toISOString().slice(0, 10)
          ? 'mojeTerminy.pristiTyden'
          : 'mojeTerminy.tyden',
    );
    return t('mojeTerminy.popisTydne', { nazev, od: f(od), do: f(ne) });
  }
  const denKratce = (iso: string, tz: string) =>
    new Intl.DateTimeFormat(kod, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(iso));

  const poTydnech = new Map<string, Nataceni[]>();
  for (const termin of terminy) {
    const k = pondeli(termin.start, termin.timezone);
    if (!poTydnech.has(k)) poTydnech.set(k, []);
    poTydnech.get(k)!.push(termin);
  }
  const tydny = Array.from(poTydnech.entries());

  if (terminy.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
        {t('mojeTerminy.mojeNataceni')}
      </h2>
      {info && <p className="text-sm font-body text-ink bg-okTint border border-line rounded-lg px-3 py-2 m-0">{info}</p>}
      {/* PO TÝDNECH, KAŽDÝ TERMÍN NA JEDEN ŘÁDEK (zadání 19. 9. 2026: „termíny,
          které jsou v jeden týden, dát k sobě… aby bylo jednoznačné, ve kterém
          studiu v ten den natáčí… informace dal na řádek vedle sebe"). */}
      {tydny.map(([klic, vTydnu]) => (
        <div key={klic} className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-2.5 bg-field border-b border-line flex items-baseline justify-between gap-3">
            <span className="text-xs font-heading font-semibold text-ink uppercase tracking-wide">
              {popisTydne(klic)}
            </span>
            <span className="text-xs font-body text-muted tabular-nums">
              {t(klicFrekvenci(vTydnu.length), { pocet: vTydnu.length })}
            </span>
          </div>
          <ul className="list-none p-0 m-0 divide-y divide-line">
            {vTydnu.map((termin) => {
              const otevreno = otevreny === termin.id;
              const podleDnu = new Map<string, Misto[]>();
              for (const m of mista ?? []) {
                const k = new Intl.DateTimeFormat('en-CA', { timeZone: termin.timezone }).format(new Date(m.start));
                if (!podleDnu.has(k)) podleDnu.set(k, []);
                podleDnu.get(k)!.push(m);
              }
              return (
                <li key={termin.id}>
                  <div className="px-4 sm:px-5 py-3 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[9.5rem_7rem_minmax(0,1fr)_7rem_8.5rem_auto] items-center gap-x-4 gap-y-1">
                    <span className="font-heading font-semibold text-ink capitalize">{denKratce(termin.start, termin.timezone)}</span>
                    <span className="font-heading font-semibold text-ink tabular-nums hidden sm:inline">
                      {cas(termin.start, termin.timezone)}–{cas(termin.end, termin.timezone)}
                    </span>
                    <span className="text-sm font-body text-muted truncate hidden sm:inline" title={termin.projekt}>
                      {termin.projekt}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-heading font-semibold text-ink">
                      <span className="w-2 h-2 rounded-full bg-brand-purple" aria-hidden="true" />
                      {termin.studio}
                    </span>
                    <span className="hidden sm:inline">
                      <StavTerminu potvrzeno={termin.potvrzeno} />
                    </span>
                    {/* Na telefonu se to same poskláda pod sebe do dvou řádků. */}
                    <span className="sm:hidden col-start-1 text-sm font-body text-muted">
                      <span className="font-heading font-semibold text-ink tabular-nums">
                        {cas(termin.start, termin.timezone)}–{cas(termin.end, termin.timezone)}
                      </span>{' '}
                      · {termin.studio} · {termin.projekt}
                    </span>
                    <span className="sm:hidden col-start-1">
                      <StavTerminu potvrzeno={termin.potvrzeno} />
                    </span>
                    <span className="row-start-1 col-start-2 sm:row-auto sm:col-auto justify-self-end">
                      {termin.potvrzeno && (
                        <button
                          type="button"
                          onClick={() => otevri(termin.id)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-heading font-semibold whitespace-nowrap transition-colors ${
                            otevreno ? 'border-line text-muted' : 'border-brand-purple text-brand-purple hover:bg-tint'
                          }`}
                        >
                          {t(otevreno ? 'mojeTerminy.zavrit' : 'mojeTerminy.zmenaTerminu')}
                        </button>
                      )}
                    </span>
                  </div>
                  {termin.zadost && (
                    <p className="px-4 sm:px-5 pb-3 -mt-1 m-0 text-xs font-body text-status-progress">
                      {t('mojeTerminy.cekaPresun', {
                        den: denKratce(termin.zadost.start, termin.timezone),
                        od: cas(termin.zadost.start, termin.timezone),
                        do: cas(termin.zadost.end, termin.timezone),
                      })}{' '}
                      <button type="button" onClick={() => zrusZadost(termin.id)} className="underline">
                        {t('mojeTerminy.zrusitZadost')}
                      </button>
                    </p>
                  )}

                  {otevreno && (
                    <div className="border-t border-line bg-surfaceSoft px-4 sm:px-5 py-4 flex flex-col gap-3">
                      <p className="text-sm font-body text-ink m-0">
                        {limit
                          ? t('mojeTerminy.vyberteNovySLimitem', { datum: datum(limit) })
                          : t('mojeTerminy.vyberteNovy')}
                      </p>
                      {nacita && !mista && (
                        <p className="text-sm text-muted m-0">{t('mojeTerminy.hledamVolne')}</p>
                      )}
                      {chyba && (
                        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>
                      )}
                      {mista && mista.length === 0 && (
                        <p className="text-sm text-muted m-0">{t('mojeTerminy.zadnyJiny')}</p>
                      )}
                      <div className="flex flex-col gap-2 max-h-[26rem] overflow-y-auto pr-1">
                        {Array.from(podleDnu.entries()).map(([k, dne]) => (
                          <div key={k} className="flex items-baseline gap-3 flex-wrap">
                            <span className="w-32 shrink-0 text-xs font-heading font-semibold text-ink capitalize">
                              {denKratce(dne[0].start, termin.timezone)}
                            </span>
                            <span className="flex flex-wrap gap-2">
                              {dne.map((m) => (
                                <button
                                  key={`${m.studioId}-${m.start}`}
                                  type="button"
                                  disabled={nacita}
                                  onClick={() => presun(termin.id, m)}
                                  title={t(m.poTerminu ? 'mojeTerminy.poTerminu' : 'mojeTerminy.presunoutSem')}
                                  className={`rounded-pill border px-3 py-1 text-sm font-heading font-semibold tabular-nums transition-colors disabled:opacity-50 ${
                                    m.poTerminu
                                      ? 'border-dashed border-status-progress text-status-progress hover:bg-warnTint'
                                      : 'border-line text-ink hover:border-brand-purple hover:bg-tint'
                                  }`}
                                >
                                  {cas(m.start, termin.timezone)}–{cas(m.end, termin.timezone)}
                                  {m.poTerminu ? ' ⚠' : ''}
                                </button>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* HLÁŠKA O POSUNU ODEVZDÁNÍ (zadání 19. 9. 2026) */}
      {potvrdit && (
        <div
          className="fixed inset-0 z-[60] bg-black/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPotvrdit(null);
          }}
        >
          <div className="w-full max-w-md bg-surface rounded-card border-2 border-status-progress p-5 flex flex-col gap-3 shadow-lg">
            <p className="font-heading font-semibold text-ink m-0 text-lg">
              {t('mojeTerminy.musimePotvrditNadpis')}
            </p>
            <p className="text-sm font-body text-ink m-0">
              {t('mojeTerminy.musimePotvrditText', {
                datum: limit ? datum(limit) : t('mojeTerminy.terminOdevzdani'),
              })}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => presun(potvrdit.slotId, potvrdit.misto, true)}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep"
              >
                {t('mojeTerminy.pozadatOPresun')}
              </button>
              <button type="button" onClick={() => setPotvrdit(null)} className="text-sm font-heading text-muted">
                {t('mojeTerminy.vybratJiny')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Stav termínu - potvrzený svítí zeleně (zadání 19. 9. 2026). */
function StavTerminu({ potvrzeno }: { potvrzeno: boolean }) {
  const t = usePreklad();
  return potvrzeno ? (
    <span className="inline-flex items-center gap-1 rounded-pill bg-okTint text-status-done px-2.5 py-0.5 text-xs font-heading font-semibold whitespace-nowrap">
      {t('mojeTerminy.potvrzeno')}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-pill bg-warnTint text-status-progress px-2.5 py-0.5 text-xs font-heading font-semibold whitespace-nowrap">
      {t('mojeTerminy.cekaNaPotvrzeni')}
    </span>
  );
}
