'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, minutesInZone, minutesToTime, remainingToPick } from '@/lib/calendar';
import { oslovit } from '@/lib/osloveni';
import { zonedToUtc } from '@/lib/calendar';
import { POZNAMKA_NAVRH_HERCE } from '@/lib/volnaMista';
import { PridatDoKalendare } from '@/components/PridatDoKalendare';
import { kodJazyka, prelozit, prelozitS, prelozitKolem, type Jazyk } from '@/lib/jazyk';

type Slot = { id: string; start: string; end: string; studio: string; studioId?: string; poznamka?: string | null };

/**
 * Samotný výběr. Tlačítko „Odeslat ke schválení" je aktivní jen při PŘESNÉM
 * počtu termínů (zadani 8. 9. 2026) — herec tedy nemůže poslat míň ani víc.
 */
export function ActorPicker({
  jazyk,
  token,
  status,
  actorName,
  requiredSessions,
  timezone,
  note,
  decisionNote,
  holdUntil,
  offered,
  chosen,
  kalendarUrl,
}: {
  /** Veřejná stránka stojí mimo JazykProvider - jazyk chodí propem. */
  jazyk: Jazyk;
  token: string;
  status: string;
  actorName: string;
  requiredSessions: number;
  timezone: string;
  note: string | null;
  decisionNote: string | null;
  holdUntil: string | null;
  offered: Slot[];
  chosen: (Slot & { state: string })[];
  /** Studia, ve kterých si herec může navrhnout vlastní čas. */
  studia?: { id: string; name: string }[];
  obdobiOd?: string;
  obdobiDo?: string;
  /** Potvrzené termíny ve formátu kalendáře (19. 9. 2026). */
  kalendarUrl?: string;
}) {
  const t = (klic: string, hodnoty?: Record<string, string | number>) =>
    hodnoty ? prelozitS(jazyk, klic, hodnoty) : prelozit(jazyk, klic);
  const kod = kodJazyka(jazyk);
  const router = useRouter();
  const [vybrano, setVybrano] = useState<string[]>([]);
  const [poznamka, setPoznamka] = useState(note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zbyva = remainingToPick(requiredSessions, vybrano.length);

  // --- Vlastni cas u terminu (zadani 19. 9. 2026) ---------------------------
  /**
   * „U každého času a termínu bych dal ještě tlačítko Vybrat vlastní čas."
   * Otevře se přímo pod termínem s jeho časem předvyplněným - herec ho posune
   * nebo zkrátí (14–18, jen tři hodiny). Server ověří, že je ve studiu v tu
   * dobu volno; když je obsazené jedno brněnské studio, zkusí druhé.
   */
  const [vlastni, setVlastni] = useState<{ slotId: string; od: string; doo: string } | null>(null);
  const [vlastniChyba, setVlastniChyba] = useState<string | null>(null);

  const hhmm = (iso: string) =>
    new Intl.DateTimeFormat(kod, { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(iso),
    );

  async function ulozVlastni(slot: Slot) {
    if (!vlastni) return;
    setVlastniChyba(null);
    const naMin = (t: string) => {
      const [h, mm] = t.split(':').map(Number);
      return h * 60 + mm;
    };
    if (!vlastni.od || !vlastni.doo || naMin(vlastni.doo) <= naMin(vlastni.od)) {
      setVlastniChyba(t('terminyVyber.chybaKonec'));
      return;
    }
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
      .format(new Date(slot.start))
      .split('-')
      .map(Number);
    setBusy(true);
    try {
      const res = await fetch(`/api/terminy/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'navrh',
          studioId: slot.studioId,
          start: zonedToUtc(y, m, d, naMin(vlastni.od), timezone).toISOString(),
          end: zonedToUtc(y, m, d, naMin(vlastni.doo), timezone).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVlastniChyba(data?.error || t('terminyVyber.chybaVlastni'));
        return;
      }
      // Vlastni cas nahradi termin, u ktereho ho herec zadal.
      if (data?.id) {
        setVybrano((cur) => {
          const bez = cur.filter((x) => x !== slot.id && x !== data.id);
          return bez.length < requiredSessions ? [...bez, data.id] : bez;
        });
      }
      setVlastni(null);
      router.refresh();
    } catch {
      setVlastniChyba(t('terminyVyber.chybaVlastni'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Herci se studio NEUKAZUJE (zadání 19. 9. 2026: „nabízel bych jednoduše
   * jen termíny za Brno"). Místo se mu přidělí samo, přednostně Brno I.
   * Jen když nabídka zasahuje do víc měst, napíše se u času město.
   */
  const mestoZ = (nazev: string) => (nazev.split(' - ').pop() ?? nazev).replace(/\s+[IVX]+$/, '').trim();
  const viceStudii = new Set(offered.map((s) => mestoZ(s.studio))).size > 1;

  /** Překrývá se místo s už vybraným? Herec nemůže být ve dvou studiích naráz. */
  function koliduje(slot: Slot): boolean {
    const od = new Date(slot.start).getTime();
    const doo = new Date(slot.end).getTime();
    return offered.some(
      (o) =>
        o.id !== slot.id &&
        vybrano.includes(o.id) &&
        new Date(o.start).getTime() < doo &&
        new Date(o.end).getTime() > od,
    );
  }
  const hotovo = vybrano.length === requiredSessions;

  function prepni(id: string) {
    setError(null);
    setVybrano((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function odesli() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/terminy/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', slotIds: vybrano, note: poznamka || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('terminyVyber.chybaOdeslani'));
        // Kdyz mezitim nekdo termin obsadil, at herec vidi aktualni nabidku.
        if (res.status === 409) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError(t('terminyVyber.chybaOdeslani'));
    } finally {
      setBusy(false);
    }
  }

  function popisDne(iso: string): string {
    return new Intl.DateTimeFormat(kod, {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(iso));
  }

  function popisCasu(slot: Slot): string {
    return `${minutesToTime(minutesInZone(new Date(slot.start), timezone))} – ${minutesToTime(
      minutesInZone(new Date(slot.end), timezone),
    )}`;
  }

  // --- Stavy, kdy se uz nevybira -------------------------------------------

  if (status === 'CANCELLED') {
    return (
      <Hlaska barva="red">
        <strong>{t('terminyVyber.zrusenaTuk')}</strong> {t('terminyVyber.zrusenaText')}
      </Hlaska>
    );
  }

  if (status === 'REJECTED') {
    return (
      <Hlaska barva="red">
        <strong>{t('terminyVyber.zamitnutTuk')}</strong>{' '}
        {decisionNote ? t('terminyVyber.duvod', { duvod: decisionNote }) : t('terminyVyber.zamitnutJinak')}
      </Hlaska>
    );
  }

  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    return (
      <div className="bg-okTint border border-line rounded-card p-6 flex flex-col gap-3">
        <p className="font-display text-2xl text-ink m-0">{t('terminyVyber.potvrzeneNadpis')}</p>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {chosen.map((s) => (
            <li key={s.id} className="text-sm font-heading text-ink">
              <span className="capitalize">{popisDne(s.start)}</span>
              <span className="text-muted font-body tabular-nums"> · {popisCasu(s)}</span>
              {viceStudii || new Set(chosen.map((c) => mestoZ(c.studio))).size > 1 ? (
                <span className="text-muted font-body"> · {mestoZ(s.studio)}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {kalendarUrl && <PridatDoKalendare url={kalendarUrl} />}
        <p className="text-sm font-body text-muted m-0">{t('terminyVyber.tesimeSe')}</p>
      </div>
    );
  }

  if (status === 'SUBMITTED') {
    return (
      <div className="bg-surface border border-line rounded-card p-6 flex flex-col gap-3 shadow-sm">
        <p className="font-display text-2xl text-ink m-0">{t('terminyVyber.odeslanoNadpis')}</p>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {chosen.map((s) => (
            <li key={s.id} className="text-sm font-heading text-ink">
              <span className="capitalize">{popisDne(s.start)}</span>
              <span className="text-muted font-body tabular-nums"> · {popisCasu(s)}</span>
              {viceStudii || new Set(chosen.map((c) => mestoZ(c.studio))).size > 1 ? (
                <span className="text-muted font-body"> · {mestoZ(s.studio)}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm font-body text-muted m-0">
          {holdUntil
            ? t('terminyVyber.drzenoDo', { kdy: formatDateTime(holdUntil, timezone, jazyk) })
            : t('terminyVyber.drzeno')}
        </p>
      </div>
    );
  }

  // --- Vlastni vyber --------------------------------------------------------

  const podleDnu = new Map<string, Slot[]>();
  for (const slot of offered) {
    const den = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(slot.start));
    if (!podleDnu.has(den)) podleDnu.set(den, []);
    podleDnu.get(den)!.push(slot);
  }
  /**
   * Skloňování termínů (1 / 2-4 / 5+); anglicky z klíčů vyjde jednotné nebo
   * množné číslo. Celá věta je jeden klíč a počet v ní stojí tlustě, proto se
   * dělí přes prelozitKolem - viz pravidlo 7 v docs/preklad-portalu.md.
   */
  const klicTerminu = (n: number) =>
    n === 1 ? 'terminyVyber.termin1' : n >= 2 && n <= 4 ? 'terminyVyber.termin234' : 'terminyVyber.termin5';
  const pocetTerminu = t(klicTerminu(requiredSessions), { pocet: requiredSessions });
  const [uvodPred, uvodPo] = prelozitKolem(jazyk, 'terminyVyber.uvod', 'pocet', {
    // Česky se jméno skloňuje do 5. pádu („Dobrý den, Radko"), anglicky se
    // oslovuje jménem, jak je - viz lib/osloveni.ts.
    jmeno: jazyk === 'en' ? actorName : oslovit(actorName) || actorName,
  });

  return (
    <div className="flex flex-col gap-5">
      {status === 'RETURNED' && (
        <Hlaska barva="oranzova">
          <strong>{t('terminyVyber.novyVyberTuk')}</strong>
          {decisionNote ? ` ${decisionNote}` : ''}
        </Hlaska>
      )}

      <p className="text-sm font-body text-ink m-0">
        {uvodPred}
        <strong>{pocetTerminu}</strong>
        {uvodPo}
      </p>

      {/* ODESLAT JE NAHOŘE A POŘÁD NA OČÍCH (zadání 19. 9. 2026: „tlačítko
          odeslat je až dole a když je tam hodně termínů, člověk musí rolovat.
          Držel bych ho nahoře a prosvítí se, až budou vyplněny… a zvýraznil
          bych číslo, kolik frekvencí je ještě potřeba zakliknout"). */}
      <div className="sticky top-2 z-10 bg-brand-purple text-white rounded-card px-4 sm:px-5 py-3 flex items-center justify-between gap-3 shadow-lg">
        <span className="flex items-center gap-3 min-w-0">
          {hotovo ? (
            <span className="font-heading font-semibold">
              {t('terminyVyber.vybranoVse', { pocet: requiredSessions })}
            </span>
          ) : (
            <>
              <span className="grid place-items-center min-w-[2.75rem] h-11 px-2 rounded-full bg-white text-brand-purpleDeep font-display text-2xl tabular-nums leading-none">
                {zbyva}
              </span>
              <span className="font-heading font-semibold leading-tight">
                {t(zbyva === requiredSessions ? 'terminyVyber.zbyvaVybrat' : 'terminyVyber.jesteZbyva')}
                <span className="block text-xs font-body text-white/80">
                  {t('terminyVyber.vybranoZ', { vybrano: vybrano.length, celkem: requiredSessions })}
                </span>
              </span>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={odesli}
          disabled={busy || !hotovo}
          className={`shrink-0 font-heading font-semibold rounded-lg px-4 sm:px-5 py-2.5 transition-all ${
            hotovo
              ? 'bg-brand-green text-[#0F2A18] shadow-[0_0_0_4px_rgba(123,255,150,0.25)] hover:brightness-105'
              : 'bg-white/15 text-white/60 cursor-not-allowed'
          }`}
        >
          {t(busy ? 'terminyVyber.odesilam' : 'terminyVyber.odeslatKeSchvaleni')}
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>
      )}

      {offered.length === 0 && (
        <p className="text-sm font-body text-muted m-0">{t('terminyVyber.zadneVolne')}</p>
      )}

      <div className="flex flex-col gap-4">
        {Array.from(podleDnu.entries()).map(([den, sloty]) => (
          <div key={den} className="flex flex-col gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide capitalize">
              {popisDne(sloty[0].start)}
            </span>
            <div className="flex flex-col gap-2">
              {sloty.map((slot) => {
                const zvoleno = vybrano.includes(slot.id);
                const soubeh = !zvoleno && koliduje(slot);
                const plno = !zvoleno && (hotovo || soubeh);
                const upravuje = vlastni?.slotId === slot.id;
                const jeNavrh = slot.poznamka === POZNAMKA_NAVRH_HERCE;
                return (
                  <div
                    key={slot.id}
                    className={`rounded-card border transition-colors ${
                      zvoleno
                        ? 'bg-tint border-brand-purple'
                        : plno
                          ? 'bg-surface border-line opacity-50'
                          : 'bg-surface border-line hover:border-brand-purple'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => prepni(slot.id)}
                        disabled={busy || soubeh}
                        aria-pressed={zvoleno}
                        className="flex items-center gap-3 text-left flex-1 min-w-0"
                      >
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold shrink-0 ${
                            zvoleno ? 'bg-brand-purple border-brand-purple text-white' : 'border-line text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span className="font-heading font-semibold text-ink tabular-nums">{popisCasu(slot)}</span>
                        {viceStudii && <span className="text-sm font-body text-muted">{mestoZ(slot.studio)}</span>}
                        {jeNavrh && (
                          <span className="text-xs font-heading font-semibold rounded-pill px-2 py-0.5 bg-tint text-brand-purple">
                            {t('terminyVyber.vasCas')}
                          </span>
                        )}
                        {soubeh && (
                          <span className="text-xs font-body text-muted">{t('terminyVyber.jizVybrano')}</span>
                        )}
                      </button>
                      {!upravuje && !soubeh && (
                        <button
                          type="button"
                          onClick={() => {
                            setVlastniChyba(null);
                            setVlastni({ slotId: slot.id, od: hhmm(slot.start), doo: hhmm(slot.end) });
                          }}
                          disabled={busy}
                          className="shrink-0 text-xs font-heading font-semibold text-brand-purple hover:underline"
                        >
                          {t('terminyVyber.vybratVlastni')}
                        </button>
                      )}
                    </div>
                    {upravuje && vlastni && (
                      <div className="border-t border-line px-4 py-3 flex items-end gap-3 flex-wrap">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-heading text-muted">{t('terminyVyber.od')}</span>
                          <input
                            type="time"
                            step={1800}
                            value={vlastni.od}
                            onChange={(e) => setVlastni({ ...vlastni, od: e.target.value })}
                            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink tabular-nums"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-heading text-muted">{t('terminyVyber.do')}</span>
                          <input
                            type="time"
                            step={1800}
                            value={vlastni.doo}
                            onChange={(e) => setVlastni({ ...vlastni, doo: e.target.value })}
                            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink tabular-nums"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => ulozVlastni(slot)}
                          disabled={busy}
                          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
                        >
                          {t('terminyVyber.pouzitCas')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVlastni(null)}
                          className="text-sm font-heading text-muted"
                        >
                          {t('terminyVyber.zrusit')}
                        </button>
                        {vlastniChyba && (
                          <p className="w-full text-sm text-danger m-0">{vlastniChyba}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {offered.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('terminyVyber.poznamkaProProdukci')}</span>
          <textarea
            value={poznamka}
            onChange={(e) => setPoznamka(e.target.value)}
            rows={3}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
          />
        </label>
      )}
    </div>
  );
}

function Hlaska({ barva, children }: { barva: 'red' | 'oranzova'; children: React.ReactNode }) {
  return (
    <p
      className={`text-sm font-body m-0 rounded-card px-4 py-3 border border-line ${
        barva === 'red' ? 'bg-dangerTint text-ink' : 'bg-warnTint text-ink'
      }`}
    >
      {children}
    </p>
  );
}
