'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CALENDAR_VIEWS,
  SLOT_STATE_CLASSES,
  SLOT_STATE_LABELS,
  BLOCK_KIND_LABELS,
  WEEKDAY_SHORT,
  formatDateTime,
  minutesInZone,
  minutesToTime,
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
  start: string;
  end: string;
  state: string;
  title: string;
  subtitle?: string;
  href?: string;
};

/**
 * Kalendář studia. Mřížka se kreslí v pásmu studia (v Londýně začíná den
 * jinde), události se do ní umisťují podle minut od půlnoci — proto
 * `minutesInZone`, ne lokální čas prohlížeče.
 */
export function CalendarBrowser({
  studios,
  studioId,
  timezone,
  view,
  anchorIso,
  days,
  events,
  gridStartHour,
  gridEndHour,
  canManage,
}: {
  studios: { id: string; shortName: string; name: string; timezone: string }[];
  studioId: string;
  timezone: string;
  view: CalendarView;
  anchorIso: string;
  days: CalendarDay[];
  events: CalendarEvent[];
  gridStartHour: number;
  gridEndHour: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [filtrStavu, setFiltrStavu] = useState<string>('');
  const [hledani, setHledani] = useState('');
  const [detail, setDetail] = useState<CalendarEvent | null>(null);

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
    const params = new URLSearchParams({ studio: studioId, pohled: view, datum: anchorIso, ...zmeny });
    router.push(`/kalendar?${params.toString()}`);
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
      {/* Hlavicka: studia, pohled, posun v case */}
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
                  v.key === view ? 'bg-brand-purple text-white' : 'bg-white text-muted hover:text-ink'
                }`}
              >
                {v.label}
              </button>
            ))}
          </span>
        </div>
      </div>

      {/* Studia */}
      <div className="flex items-center gap-1 flex-wrap">
        {studios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => prejdi({ studio: s.id })}
            title={s.name}
            className={`px-4 py-2 text-sm font-heading font-semibold rounded-pill transition-colors ${
              s.id === studioId ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {s.shortName}
          </button>
        ))}
      </div>

      {/* Filtry a legenda */}
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
        <span className="flex items-center gap-3 flex-wrap text-[11px] font-body text-muted ml-auto">
          <Legenda className="bg-brand-purple border-brand-purpleDeep" label="potvrzeno" />
          <Legenda className="bg-[#FFF3E0] border-status-progress" label="drženo" />
          <Legenda className="bg-[#F1ECFF] border-brand-purple" label="nabídnuto" />
          <Legenda className="bg-line border-muted" label="blokace" />
        </span>
      </div>

      {view === 'mesic' ? (
        <MesicniPohled days={days} podleDnu={podleDnu} timezone={timezone} onDetail={setDetail} />
      ) : (
        <MrizkaPohled
          days={days}
          podleDnu={podleDnu}
          timezone={timezone}
          gridStartHour={gridStartHour}
          gridEndHour={gridEndHour}
          onDetail={setDetail}
        />
      )}

      {detail && (
        <DetailUdalosti
          event={detail}
          timezone={timezone}
          canManage={canManage}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}

function Legenda({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded border ${className}`} />
      {label}
    </span>
  );
}

/** Denní a týdenní mřížka: sloupce = dny, řádky = hodiny. */
function MrizkaPohled({
  days,
  podleDnu,
  timezone,
  gridStartHour,
  gridEndHour,
  onDetail,
}: {
  days: CalendarDay[];
  podleDnu: Map<string, CalendarEvent[]>;
  timezone: string;
  gridStartHour: number;
  gridEndHour: number;
  onDetail: (e: CalendarEvent) => void;
}) {
  const celkemMinut = (gridEndHour - gridStartHour) * 60;
  const hodiny = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);
  // Dnesek podle pasma STUDIA, ne podle prohlizece - "en-CA" vraci YYYY-MM-DD.
  const dnesKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

  return (
    <div className="bg-white rounded-card border border-line shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Hlavicka dnu */}
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((den) => {
              const d = new Date(den.startIso);
              const cislo = new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, day: 'numeric', month: 'numeric' }).format(d);
              // den.key je datum v pasmu studia, takze den v tydnu bereme z nej
              const dow = new Date(`${den.key}T12:00:00.000Z`).getUTCDay();
              return (
                <div
                  key={den.key}
                  className={`px-2 py-2.5 text-center border-l border-line ${
                    den.key === dnesKey ? 'bg-[#F1ECFF]' : ''
                  }`}
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

          {/* Mrizka */}
          <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            <div className="relative" style={{ height: `${celkemMinut}px` }}>
              {hodiny.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-body text-muted tabular-nums"
                  style={{ top: `${(h - gridStartHour) * 60}px` }}
                >
                  {h}:00
                </div>
              ))}
            </div>

            {days.map((den) => (
              <div
                key={den.key}
                className="relative border-l border-line"
                style={{ height: `${celkemMinut}px` }}
              >
                {/* Cary po hodinach */}
                {hodiny.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-line/60"
                    style={{ top: `${(h - gridStartHour) * 60}px` }}
                  />
                ))}
                {/* Mimo pracovni dobu studia */}
                {den.openFrom !== null && den.openTo !== null && (
                  <>
                    <div
                      className="absolute left-0 right-0 bg-field/70"
                      style={{
                        top: 0,
                        height: `${Math.max(0, Math.min(celkemMinut, den.openFrom - gridStartHour * 60))}px`,
                      }}
                    />
                    <div
                      className="absolute left-0 right-0 bg-field/70"
                      style={{
                        top: `${Math.max(0, den.openTo - gridStartHour * 60)}px`,
                        bottom: 0,
                      }}
                    />
                  </>
                )}

                {(podleDnu.get(den.key) ?? []).map((e) => {
                  const od = minutesInZone(new Date(e.start), timezone);
                  const doo = minutesInZone(new Date(e.end), timezone) || 24 * 60;
                  const top = Math.max(0, od - gridStartHour * 60);
                  const vyska = Math.max(22, Math.min(celkemMinut - top, doo - od));
                  const barva =
                    e.kind === 'BLOCK'
                      ? 'bg-line border-muted text-ink'
                      : SLOT_STATE_CLASSES[e.state] ?? 'bg-field border-line text-muted';
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onDetail(e)}
                      style={{ top: `${top}px`, height: `${vyska}px` }}
                      className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left overflow-hidden ${barva}`}
                    >
                      <span className="block text-[11px] font-heading font-semibold leading-tight truncate">
                        {e.title}
                      </span>
                      <span className="block text-[10px] font-body opacity-80 tabular-nums">
                        {minutesToTime(od)}–{minutesToTime(doo)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
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
    <div className="bg-white rounded-card border border-line shadow-sm overflow-hidden">
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
              className={`min-h-[96px] border-t border-l border-line p-1.5 flex flex-col gap-1 ${
                den.inMonth ? '' : 'bg-[#FBFAFF]'
              } ${den.key === dnesKey ? 'bg-[#F1ECFF]' : ''}`}
            >
              <span
                className={`text-xs font-heading tabular-nums ${den.inMonth ? 'text-ink' : 'text-muted'}`}
              >
                {cislo}
              </span>
              {udalosti.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onDetail(e)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-heading text-left truncate border ${
                    e.kind === 'BLOCK'
                      ? 'bg-line border-muted text-ink'
                      : SLOT_STATE_CLASSES[e.state] ?? 'bg-field border-line text-muted'
                  }`}
                >
                  {e.title}
                </button>
              ))}
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

function DetailUdalosti({
  event,
  timezone,
  canManage,
  onClose,
}: {
  event: CalendarEvent;
  timezone: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const stav =
    event.kind === 'BLOCK'
      ? BLOCK_KIND_LABELS[event.state] ?? 'Blokace'
      : SLOT_STATE_LABELS[event.state] ?? event.state;

  return (
    <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-heading text-muted uppercase tracking-wide">{stav}</span>
          <h2 className="font-display text-xl text-ink m-0 mt-0.5">{event.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>
      <p className="text-sm font-body text-muted m-0">
        {formatDateTime(event.start, timezone)} – {formatDateTime(event.end, timezone)}
      </p>
      {event.subtitle && <p className="text-sm font-body text-muted m-0">{event.subtitle}</p>}
      {event.href && canManage && (
        <Link
          href={event.href}
          className="text-sm font-heading font-semibold text-brand-purple no-underline self-start"
        >
          Otevřít nabídku termínů →
        </Link>
      )}
    </div>
  );
}
