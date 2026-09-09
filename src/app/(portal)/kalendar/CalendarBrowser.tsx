'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BLOCK_KIND_LABELS,
  CALENDAR_VIEWS,
  GRID_END_HOUR,
  GRID_SCROLL_TO_HOUR,
  GRID_START_HOUR,
  HOUR_PX,
  SLOT_STATE_LABELS,
  WEEKDAY_SHORT,
  eventColors,
  formatDateTime,
  gridPosition,
  minutesInZone,
  minutesToTime,
  zonedToUtc,
  type CalendarView,
} from '@/lib/calendar';

export type CalendarDay = {
  key: string;
  startIso: string;
  endIso: string;
  inMonth: boolean;
  byArrangement: boolean;
  openFrom: number | null;
  openTo: number | null;
};

export type CalendarEvent = {
  id: string;
  kind: 'SLOT' | 'BLOCK';
  studioId: string;
  studioName: string;
  color: string;
  start: string;
  end: string;
  state: string;
  title: string;
  subtitle?: string;
  href?: string;
};

type Studio = { id: string; shortName: string; name: string; timezone: string; color: string };

/**
 * Kalendář studií. Kreslí celý den 0–24 (zprava uzivatele 9. 9. 2026) a umí
 * PROLNOUT víc studií najednou — každé má svou barvu a dá se vypnout.
 * Dvojklik do volného místa založí blokaci.
 */
export function CalendarBrowser({
  studios,
  selectedStudioIds,
  timezone,
  view,
  anchorIso,
  days,
  events,
  canManage,
}: {
  studios: Studio[];
  selectedStudioIds: string[];
  timezone: string;
  view: CalendarView;
  anchorIso: string;
  days: CalendarDay[];
  events: CalendarEvent[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [filtrStavu, setFiltrStavu] = useState<string>('');
  const [hledani, setHledani] = useState('');
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [novaBlokace, setNovaBlokace] = useState<{ studioId: string; start: string; end: string } | null>(null);

  const viditelne = useMemo(() => {
    const dotaz = hledani.trim().toLowerCase();
    return events.filter((e) => {
      if (filtrStavu && e.state !== filtrStavu) return false;
      if (dotaz && !e.title.toLowerCase().includes(dotaz)) return false;
      return true;
    });
  }, [events, filtrStavu, hledani]);

  /** Události rozdělené po dnech — klíčem je den v pásmu studia. */
  const podleDnu = useMemo(() => {
    const mapa = new Map<string, CalendarEvent[]>();
    for (const den of days) mapa.set(den.key, []);
    for (const e of viditelne) {
      const start = new Date(e.start);
      for (const den of days) {
        if (start >= new Date(den.startIso) && start < new Date(den.endIso)) {
          mapa.get(den.key)!.push(e);
          break;
        }
      }
    }
    return mapa;
  }, [days, viditelne]);

  function prejdi(zmeny: Record<string, string>) {
    const params = new URLSearchParams({
      studia: selectedStudioIds.join(','),
      pohled: view,
      datum: anchorIso,
      ...zmeny,
    });
    router.push(`/kalendar?${params.toString()}`);
  }

  /** Zapnutí a vypnutí studia. Poslední zapnuté se vypnout nedá. */
  function prepniStudio(id: string) {
    const dalsi = selectedStudioIds.includes(id)
      ? selectedStudioIds.filter((x) => x !== id)
      : [...selectedStudioIds, id];
    if (dalsi.length === 0) return;
    prejdi({ studia: dalsi.join(',') });
  }

  function posun(smer: -1 | 1) {
    const d = new Date(`${anchorIso}T12:00:00.000Z`);
    if (view === 'den') d.setUTCDate(d.getUTCDate() + smer);
    else if (view === 'tyden') d.setUTCDate(d.getUTCDate() + 7 * smer);
    else d.setUTCMonth(d.getUTCMonth() + smer);
    prejdi({ datum: d.toISOString().slice(0, 10) });
  }

  const nadpis = useMemo(() => {
    const prvni = new Date(days[0].startIso);
    const posledni = new Date(days[days.length - 1].startIso);
    if (view === 'den') {
      return new Intl.DateTimeFormat('cs-CZ', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(prvni);
    }
    if (view === 'mesic') {
      const stred = new Date(`${anchorIso}T12:00:00.000Z`);
      return new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, month: 'long', year: 'numeric' }).format(stred);
    }
    const od = new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, day: 'numeric', month: 'numeric' }).format(prvni);
    const doo = new Intl.DateTimeFormat('cs-CZ', {
      timeZone: timezone,
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(posledni);
    return `${od} – ${doo}`;
  }, [days, view, timezone, anchorIso]);

  return (
    <section className="flex flex-col gap-5">
      {/* Hlavicka: pohled a posun v case */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Kalendář</h1>
          <p className="text-sm font-body text-muted m-0 mt-1 capitalize">{nadpis}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => posun(-1)}
            aria-label="Předchozí"
            className="w-9 h-9 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => prejdi({ datum: new Date().toISOString().slice(0, 10) })}
            className="rounded-lg border border-line px-4 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => posun(1)}
            aria-label="Další"
            className="w-9 h-9 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            ›
          </button>
          <span className="inline-flex rounded-lg border border-line overflow-hidden ml-2">
            {CALENDAR_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => prejdi({ pohled: v.key })}
                className={`px-4 py-2 text-sm font-heading font-semibold transition-colors ${
                  v.key === view ? 'bg-brand-purple text-white' : 'bg-surface text-muted hover:text-ink'
                }`}
              >
                {v.label}
              </button>
            ))}
          </span>
        </div>
      </div>

      {/* Studia - dají se prolnout, každé má svou barvu */}
      <div className="flex items-center gap-2 flex-wrap">
        {studios.map((s) => {
          const zapnute = selectedStudioIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => prepniStudio(s.id)}
              title={s.name}
              aria-pressed={zapnute}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-heading font-semibold rounded-pill border transition-colors ${
                zapnute ? 'border-transparent text-ink' : 'border-line text-muted hover:text-ink'
              }`}
              style={zapnute ? { backgroundColor: `${s.color}26` } : undefined}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: zapnute ? s.color : '#C9C3DC' }}
              />
              {s.shortName}
            </button>
          );
        })}
        {studios.length > 1 && (
          <span className="text-xs font-body text-muted ml-1">Klikáním zapnete a vypnete jednotlivé kalendáře.</span>
        )}
      </div>

      {/* Filtry */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={hledani}
          onChange={(e) => setHledani(e.target.value)}
          placeholder="Hledat projekt nebo herce…"
          className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple w-full sm:w-64"
        />
        <select
          value={filtrStavu}
          onChange={(e) => setFiltrStavu(e.target.value)}
          className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
        >
          <option value="">Všechny stavy</option>
          {Object.entries(SLOT_STATE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {canManage && view !== 'mesic' && (
          <span className="text-xs font-body text-muted ml-auto">
            Dvojklikem do volného místa založíte blokaci.
          </span>
        )}
      </div>

      {view === 'mesic' ? (
        <MesicniPohled days={days} podleDnu={podleDnu} timezone={timezone} onDetail={setDetail} />
      ) : (
        <MrizkaPohled
          days={days}
          podleDnu={podleDnu}
          timezone={timezone}
          onDetail={setDetail}
          onNovaBlokace={
            canManage
              ? (denKey, minuty) => {
                  const [y, m, d] = denKey.split('-').map(Number);
                  // Zaokrouhli na celou hodinu a nabídni hodinu dlouhou blokaci.
                  const od = Math.floor(minuty / 60) * 60;
                  setNovaBlokace({
                    studioId: selectedStudioIds[0],
                    start: zonedToUtc(y, m, d, od, timezone).toISOString(),
                    end: zonedToUtc(y, m, d, Math.min(24 * 60, od + 60), timezone).toISOString(),
                  });
                }
              : undefined
          }
        />
      )}

      {novaBlokace && (
        <BlokaceForm
          studios={studios.filter((s) => selectedStudioIds.includes(s.id))}
          vychozi={novaBlokace}
          timezone={timezone}
          onClose={() => setNovaBlokace(null)}
          onHotovo={() => {
            setNovaBlokace(null);
            router.refresh();
          }}
        />
      )}

      {detail && (
        <DetailUdalosti
          event={detail}
          timezone={timezone}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onSmazano={() => {
            setDetail(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

/** Denní a týdenní mřížka: sloupce = dny, řádky = hodiny, celých 0–24. */
function MrizkaPohled({
  days,
  podleDnu,
  timezone,
  onDetail,
  onNovaBlokace,
}: {
  days: CalendarDay[];
  podleDnu: Map<string, CalendarEvent[]>;
  timezone: string;
  onDetail: (e: CalendarEvent) => void;
  onNovaBlokace?: (denKey: string, minuty: number) => void;
}) {
  const celkovaVyska = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;
  const hodiny = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
  const dnesKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const rolovatko = useRef<HTMLDivElement | null>(null);

  // Po otevreni se nascrolluje na rano - noc nikoho nezajima, ale je videt.
  useEffect(() => {
    if (rolovatko.current) {
      rolovatko.current.scrollTop = (GRID_SCROLL_TO_HOUR - GRID_START_HOUR) * HOUR_PX;
    }
  }, []);

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      {/* Hlavicka dnu zustava nad rolovanim */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((den) => {
              const d = new Date(den.startIso);
              const cislo = new Intl.DateTimeFormat('cs-CZ', {
                timeZone: timezone,
                day: 'numeric',
                month: 'numeric',
              }).format(d);
              const dow = new Date(`${den.key}T12:00:00.000Z`).getUTCDay();
              return (
                <div
                  key={den.key}
                  className={`px-2 py-2 text-center border-l border-line ${den.key === dnesKey ? 'bg-tint' : ''}`}
                >
                  <span className="block text-[11px] font-heading text-muted uppercase tracking-wide">
                    {WEEKDAY_SHORT[dow]}
                    {den.byArrangement && <span title="Jen po domluvě se zvukařem"> ·</span>}
                  </span>
                  <span className="block text-sm font-heading font-semibold text-ink tabular-nums">{cislo}</span>
                </div>
              );
            })}
          </div>

          <div ref={rolovatko} className="max-h-[62vh] overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
              <div className="relative" style={{ height: `${celkovaVyska}px` }}>
                {hodiny.map((h) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10px] font-body text-muted tabular-nums"
                    style={{ top: `${(h - GRID_START_HOUR) * HOUR_PX}px` }}
                  >
                    {h}:00
                  </div>
                ))}
              </div>

              {days.map((den) => (
                <div
                  key={den.key}
                  className="relative border-l border-line"
                  style={{ height: `${celkovaVyska}px` }}
                  onDoubleClick={(e) => {
                    if (!onNovaBlokace) return;
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const minuty = Math.max(0, Math.min(24 * 60 - 60, (y / HOUR_PX) * 60 + GRID_START_HOUR * 60));
                    onNovaBlokace(den.key, minuty);
                  }}
                >
                  {hodiny.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-line/50"
                      style={{ top: `${(h - GRID_START_HOUR) * HOUR_PX}px` }}
                    />
                  ))}
                  {/* Mimo pracovni dobu studia */}
                  {den.openFrom !== null && den.openTo !== null && (
                    <>
                      <div
                        className="absolute left-0 right-0 bg-field/60 pointer-events-none"
                        style={{ top: 0, height: `${(den.openFrom * HOUR_PX) / 60}px` }}
                      />
                      <div
                        className="absolute left-0 right-0 bg-field/60 pointer-events-none"
                        style={{ top: `${(den.openTo * HOUR_PX) / 60}px`, bottom: 0 }}
                      />
                    </>
                  )}

                  {(podleDnu.get(den.key) ?? []).map((e) => {
                    const od = minutesInZone(new Date(e.start), timezone);
                    const doo = minutesInZone(new Date(e.end), timezone) || 24 * 60;
                    const pozice = gridPosition(od, doo);
                    const barvy = eventColors(e.color, e.kind === 'BLOCK' ? 'BLOCK' : e.state);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onDetail(e)}
                        onDoubleClick={(ev) => ev.stopPropagation()}
                        style={{
                          top: `${pozice.top}px`,
                          height: `${pozice.height}px`,
                          backgroundColor: barvy.background,
                          borderColor: barvy.border,
                          color: barvy.text,
                        }}
                        className="absolute left-0.5 right-0.5 rounded border px-1.5 py-0.5 text-left overflow-hidden"
                      >
                        <span className="block text-[10px] font-heading font-semibold leading-tight truncate">
                          {e.title}
                        </span>
                        {pozice.height > 30 && (
                          <span className="block text-[9px] font-body opacity-80 tabular-nums truncate">
                            {minutesToTime(od)}–{minutesToTime(doo)} · {e.studioName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Měsíc: šest týdnů po sedmi dnech, v buňce jen štítky událostí. */
function MesicniPohled({
  days,
  podleDnu,
  timezone,
  onDetail,
}: {
  days: CalendarDay[];
  podleDnu: Map<string, CalendarEvent[]>;
  timezone: string;
  onDetail: (e: CalendarEvent) => void;
}) {
  const dnesKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-heading text-muted uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((den) => {
          const udalosti = podleDnu.get(den.key) ?? [];
          const cislo = new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, day: 'numeric' }).format(
            new Date(den.startIso),
          );
          return (
            <div
              key={den.key}
              className={`min-h-[92px] border-t border-l border-line p-1.5 flex flex-col gap-1 ${
                den.inMonth ? '' : 'bg-paper'
              } ${den.key === dnesKey ? 'bg-tint' : ''}`}
            >
              <span className={`text-xs font-heading tabular-nums ${den.inMonth ? 'text-ink' : 'text-muted'}`}>
                {cislo}
              </span>
              {udalosti.slice(0, 3).map((e) => {
                const barvy = eventColors(e.color, e.kind === 'BLOCK' ? 'BLOCK' : e.state);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onDetail(e)}
                    style={{ backgroundColor: barvy.background, borderColor: barvy.border, color: barvy.text }}
                    className="rounded px-1.5 py-0.5 text-[10px] font-heading text-left truncate border"
                  >
                    {e.title}
                  </button>
                );
              })}
              {udalosti.length > 3 && (
                <span className="text-[10px] font-body text-muted">+{udalosti.length - 3} další</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Založení blokace z dvojkliku. */
function BlokaceForm({
  studios,
  vychozi,
  timezone,
  onClose,
  onHotovo,
}: {
  studios: Studio[];
  vychozi: { studioId: string; start: string; end: string };
  timezone: string;
  onClose: () => void;
  onHotovo: () => void;
}) {
  const [studioId, setStudioId] = useState(vychozi.studioId);
  const [nazev, setNazev] = useState('');
  const [druh, setDruh] = useState('INTERNAL');
  const [hodin, setHodin] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = new Date(vychozi.start);
  const konec = new Date(start.getTime() + hodin * 60 * 60 * 1000);

  async function uloz() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/kalendar/blokace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId,
          start: start.toISOString(),
          end: konec.toISOString(),
          kind: druh,
          title: nazev,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Blokaci se nepodařilo uložit.');
        return;
      }
      onHotovo();
    } catch {
      setError('Blokaci se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface rounded-card border-2 border-brand-purple shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nová blokace</h2>
          <p className="text-sm font-body text-muted m-0 mt-1 capitalize">
            {new Intl.DateTimeFormat('cs-CZ', {
              timeZone: timezone,
              weekday: 'long',
              day: 'numeric',
              month: 'numeric',
            }).format(start)}{' '}
            <span className="tabular-nums">
              {minutesToTime(minutesInZone(start, timezone))}–{minutesToTime(minutesInZone(konec, timezone))}
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Studio</span>
          <select value={studioId} onChange={(e) => setStudioId(e.target.value)} className={inputClass}>
            {studios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Délka (hodin)</span>
          <input
            type="number"
            min={1}
            max={24}
            value={hodin}
            onChange={(e) => setHodin(Math.min(24, Math.max(1, Number(e.target.value) || 1)))}
            className={`${inputClass} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Druh</span>
          <select value={druh} onChange={(e) => setDruh(e.target.value)} className={inputClass}>
            {Object.entries(BLOCK_KIND_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Popis</span>
          <input
            autoFocus
            value={nazev}
            onChange={(e) => setNazev(e.target.value)}
            placeholder="Servis techniky"
            className={inputClass}
          />
        </label>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={uloz}
          disabled={busy || !nazev.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {busy ? 'Ukládám…' : 'Přidat blokaci'}
        </button>
        <button type="button" onClick={onClose} className="text-muted text-sm font-heading">
          Zrušit
        </button>
      </div>
    </div>
  );
}

function DetailUdalosti({
  event,
  timezone,
  canManage,
  onClose,
  onSmazano,
}: {
  event: CalendarEvent;
  timezone: string;
  canManage: boolean;
  onClose: () => void;
  onSmazano: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const stav =
    event.kind === 'BLOCK'
      ? BLOCK_KIND_LABELS[event.state] ?? 'Blokace'
      : SLOT_STATE_LABELS[event.state] ?? event.state;

  async function smaz() {
    if (!window.confirm('Opravdu smazat tuhle blokaci?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kalendar/blokace?id=${event.id}`, { method: 'DELETE' });
      if (res.ok) onSmazano();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: event.color }} />
          <div>
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {stav} · {event.studioName}
            </span>
            <h2 className="font-display text-xl text-ink m-0 mt-0.5">{event.title}</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>
      <p className="text-sm font-body text-muted m-0">
        {formatDateTime(event.start, timezone)} – {formatDateTime(event.end, timezone)}
      </p>
      {event.subtitle && <p className="text-sm font-body text-muted m-0">{event.subtitle}</p>}
      <div className="flex items-center gap-4">
        {event.href && canManage && (
          <Link href={event.href} className="text-sm font-heading font-semibold text-brand-purple no-underline">
            Otevřít nabídku termínů →
          </Link>
        )}
        {event.kind === 'BLOCK' && canManage && (
          <button
            type="button"
            onClick={smaz}
            disabled={busy}
            className="text-sm font-heading font-semibold text-danger disabled:opacity-60"
          >
            Smazat blokaci
          </button>
        )}
      </div>
    </div>
  );
}
