'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, minutesInZone, minutesToTime, pickingLabel, remainingToPick } from '@/lib/calendar';
import { oslovit } from '@/lib/osloveni';
import { zonedToUtc } from '@/lib/calendar';
import { POZNAMKA_NAVRH_HERCE } from '@/lib/volnaMista';
import { PridatDoKalendare } from '@/components/PridatDoKalendare';

type Slot = { id: string; start: string; end: string; studio: string; poznamka?: string | null };

/**
 * Samotný výběr. Tlačítko „Odeslat ke schválení" je aktivní jen při PŘESNÉM
 * počtu termínů (zadani 8. 9. 2026) — herec tedy nemůže poslat míň ani víc.
 */
export function ActorPicker({
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
  studia = [],
  obdobiOd,
  obdobiDo,
  kalendarUrl,
}: {
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
  /** Období natáčení „YYYY-MM-DD" - v něm se navrhuje. */
  obdobiOd?: string;
  obdobiDo?: string;
  /** Potvrzené termíny ve formátu kalendáře (19. 9. 2026). */
  kalendarUrl?: string;
}) {
  const router = useRouter();
  const [vybrano, setVybrano] = useState<string[]>([]);
  const [poznamka, setPoznamka] = useState(note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zbyva = remainingToPick(requiredSessions, vybrano.length);

  // --- Vlastni navrh casu (zadani 19. 9. 2026) ------------------------------
  const zitra = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [navrhOtevreny, setNavrhOtevreny] = useState(false);
  const [navrhDen, setNavrhDen] = useState(obdobiOd && obdobiOd > zitra ? obdobiOd : zitra);
  const [navrhStudio, setNavrhStudio] = useState(studia[0]?.id ?? '');
  const [navrhOd, setNavrhOd] = useState('14:00');
  const [navrhDo, setNavrhDo] = useState('18:00');
  const [navrhChyba, setNavrhChyba] = useState<string | null>(null);

  async function navrhni() {
    setNavrhChyba(null);
    const [y, m, d] = navrhDen.split('-').map(Number);
    const naMin = (t: string) => {
      const [h, mm] = t.split(':').map(Number);
      return h * 60 + mm;
    };
    if (!y || !navrhOd || !navrhDo || naMin(navrhDo) <= naMin(navrhOd)) {
      setNavrhChyba('Vyplňte den a čas - konec musí být po začátku.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/terminy/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'navrh',
          studioId: navrhStudio,
          start: zonedToUtc(y, m, d, naMin(navrhOd), timezone).toISOString(),
          end: zonedToUtc(y, m, d, naMin(navrhDo), timezone).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNavrhChyba(data?.error || 'Návrh se nepodařilo uložit.');
        return;
      }
      // Navrzeny cas se rovnou zaskrtne - kvuli nemu ho herec pridaval.
      if (data?.id && vybrano.length < requiredSessions) {
        setVybrano((cur) => (cur.includes(data.id) ? cur : [...cur, data.id]));
      }
      setNavrhOtevreny(false);
      router.refresh();
    } catch {
      setNavrhChyba('Návrh se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }
  /** Nabídka může mít místa ve víc studiích - pak se u času píše, kde. */
  const viceStudii = new Set(offered.map((s) => s.studio)).size > 1;

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
        setError(data?.error || 'Výběr se nepodařilo odeslat.');
        // Kdyz mezitim nekdo termin obsadil, at herec vidi aktualni nabidku.
        if (res.status === 409) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError('Výběr se nepodařilo odeslat.');
    } finally {
      setBusy(false);
    }
  }

  function popisDne(iso: string): string {
    return new Intl.DateTimeFormat('cs-CZ', {
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
        <strong>Nabídka byla zrušena.</strong> Produkce se vám ozve s novými termíny.
      </Hlaska>
    );
  }

  if (status === 'REJECTED') {
    return (
      <Hlaska barva="red">
        <strong>Tenhle výběr produkce zamítla.</strong>
        {decisionNote ? ` Důvod: ${decisionNote}` : ' Ozve se vám s dalším postupem.'}
      </Hlaska>
    );
  }

  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    return (
      <div className="bg-okTint border border-line rounded-card p-6 flex flex-col gap-3">
        <p className="font-display text-2xl text-ink m-0">Termíny jsou potvrzené</p>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {chosen.map((s) => (
            <li key={s.id} className="text-sm font-heading text-ink">
              <span className="capitalize">{popisDne(s.start)}</span>
              <span className="text-muted font-body tabular-nums"> · {popisCasu(s)}</span>
              {viceStudii || new Set(chosen.map((c) => c.studio)).size > 1 ? (
                <span className="text-muted font-body"> · {s.studio}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {kalendarUrl && <PridatDoKalendare url={kalendarUrl} />}
        <p className="text-sm font-body text-muted m-0">Těšíme se na vás ve studiu.</p>
      </div>
    );
  }

  if (status === 'SUBMITTED') {
    return (
      <div className="bg-surface border border-line rounded-card p-6 flex flex-col gap-3 shadow-sm">
        <p className="font-display text-2xl text-ink m-0">Výběr odeslán ke schválení</p>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {chosen.map((s) => (
            <li key={s.id} className="text-sm font-heading text-ink">
              <span className="capitalize">{popisDne(s.start)}</span>
              <span className="text-muted font-body tabular-nums"> · {popisCasu(s)}</span>
              {viceStudii || new Set(chosen.map((c) => c.studio)).size > 1 ? (
                <span className="text-muted font-body"> · {s.studio}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm font-body text-muted m-0">
          Děkujeme. Termíny jsou pro vás držené
          {holdUntil ? ` do ${formatDateTime(holdUntil, timezone)}` : ''} a produkce je potvrdí —
          dáme vám vědět e-mailem.
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

  return (
    <div className="flex flex-col gap-5">
      {status === 'RETURNED' && (
        <Hlaska barva="oranzova">
          <strong>Produkce vás prosí o nový výběr.</strong>
          {decisionNote ? ` ${decisionNote}` : ''}
        </Hlaska>
      )}

      <p className="text-sm font-body text-ink m-0">
        Dobrý den, {oslovit(actorName) || actorName}. Vyberte si prosím{' '}
        <strong>
          {requiredSessions} {requiredSessions === 1 ? 'termín' : requiredSessions < 5 ? 'termíny' : 'termínů'}
        </strong>{' '}
        z nabídnutých.
      </p>

      {/* Pocitadlo je videt porad, i pri rolovani dlouhym seznamem */}
      <div className="sticky top-2 z-10 bg-brand-purple text-white rounded-card px-5 py-3 flex items-center justify-between gap-4 shadow-lg">
        <span className="font-heading font-semibold">{pickingLabel(requiredSessions, vybrano.length)}</span>
        <span className="text-sm font-body text-white/85">
          {hotovo ? 'Můžete odeslat' : `Zbývá vybrat ${zbyva}`}
        </span>
      </div>

      {offered.length === 0 && (
        <p className="text-sm font-body text-muted m-0">
          Zatím tu žádné volné termíny nejsou. Produkce vám pošle nové.
        </p>
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
                // Kdyz uz je vybrano dost, ostatni se zesedi - at je jasne,
                // ze se ma neco nejdriv odebrat.
                const soubeh = !zvoleno && koliduje(slot);
                const plno = !zvoleno && (hotovo || soubeh);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => prepni(slot.id)}
                    disabled={busy || soubeh}
                    aria-pressed={zvoleno}
                    className={`flex items-center justify-between gap-4 rounded-card border px-4 py-3 text-left transition-colors ${
                      zvoleno
                        ? 'bg-tint border-brand-purple'
                        : plno
                          ? 'bg-surface border-line opacity-50'
                          : 'bg-surface border-line hover:border-brand-purple'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold ${
                          zvoleno ? 'bg-brand-purple border-brand-purple text-white' : 'border-line text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <span className="font-heading font-semibold text-ink tabular-nums">{popisCasu(slot)}</span>
                      {viceStudii && <span className="text-sm font-body text-muted">{slot.studio}</span>}
                      {slot.poznamka && (
                        <span
                          className={`text-xs font-heading font-semibold rounded-pill px-2 py-0.5 ${
                            slot.poznamka === POZNAMKA_NAVRH_HERCE ? 'bg-tint text-brand-purple' : 'bg-warnTint text-ink'
                          }`}
                        >
                          {slot.poznamka === POZNAMKA_NAVRH_HERCE ? 'Váš návrh' : slot.poznamka}
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-body text-muted">
                      {zvoleno ? 'vybráno' : soubeh ? 've stejný čas už máte vybráno' : plno ? '' : 'vybrat'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {studia.length > 0 && (
        <div className="bg-surface border border-line rounded-card p-4 flex flex-col gap-3">
          {!navrhOtevreny ? (
            <button
              type="button"
              onClick={() => setNavrhOtevreny(true)}
              className="self-start text-sm font-heading font-semibold text-brand-purple hover:underline"
            >
              + Nehodí se vám tyhle časy? Navrhněte vlastní
            </button>
          ) : (
            <>
              <p className="text-sm font-body text-ink m-0">
                Navrhněte den a čas, kdy můžete - třeba 14–18, nebo jen tři hodiny. Když je studio volné, přidá
                se do nabídky a rovnou se vám vybere.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                  <span className="text-xs font-heading text-muted">Den</span>
                  <input
                    type="date"
                    value={navrhDen}
                    min={obdobiOd && obdobiOd > zitra ? obdobiOd : zitra}
                    max={obdobiDo}
                    onChange={(e) => setNavrhDen(e.target.value)}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink"
                  />
                </label>
                {studia.length > 1 && (
                  <label className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                    <span className="text-xs font-heading text-muted">Studio</span>
                    <select
                      value={navrhStudio}
                      onChange={(e) => setNavrhStudio(e.target.value)}
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink"
                    >
                      {studia.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-heading text-muted">Od</span>
                  <input
                    type="time"
                    step={1800}
                    value={navrhOd}
                    onChange={(e) => setNavrhOd(e.target.value)}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-heading text-muted">Do</span>
                  <input
                    type="time"
                    step={1800}
                    value={navrhDo}
                    onChange={(e) => setNavrhDo(e.target.value)}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink tabular-nums"
                  />
                </label>
              </div>
              {navrhChyba && (
                <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">
                  {navrhChyba}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={navrhni}
                  disabled={busy}
                  className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
                >
                  Přidat můj čas
                </button>
                <button
                  type="button"
                  onClick={() => setNavrhOtevreny(false)}
                  className="text-sm font-heading text-muted"
                >
                  Zavřít
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {offered.length > 0 && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Poznámka pro produkci (nepovinné)</span>
            <textarea
              value={poznamka}
              onChange={(e) => setPoznamka(e.target.value)}
              rows={3}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full"
            />
          </label>

          {error && (
            <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>
          )}

          <button
            type="button"
            onClick={odesli}
            disabled={busy || !hotovo}
            className="bg-brand-purple text-white font-heading font-semibold rounded-lg px-6 py-3.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50 self-start"
          >
            {busy ? 'Odesílám…' : 'Odeslat ke schválení'}
          </button>
        </>
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
