'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RECORDING_STATUS_CLASSES,
  RECORDING_STATUS_LABELS,
  SLOT_STATE_LABELS,
  formatDateTime,
  minutesInZone,
  minutesToTime,
  overlaps,
  zonedToUtc,
} from '@/lib/calendar';

type Request = {
  id: string;
  caflouProjectId: string;
  projectName: string;
  actorName: string;
  actorEmail: string;
  studioId: string;
  studioName: string;
  timezone: string;
  pageCount: number | null;
  requiredSessions: number;
  sessionMinutes: number;
  periodFrom: string;
  periodTo: string;
  note: string;
  actorNote: string | null;
  decisionNote: string | null;
  status: string;
  holdUntil: string | null;
  sentAt: string | null;
  submittedAt: string | null;
  offerUrl: string;
};

type Slot = { id: string; start: string; end: string; state: string };
type Obsazeno = { id: string; start: string; end: string; title: string };
type Preset = { label: string; startMinutes: number; endMinutes: number };

/**
 * Sestavení nabídky termínů. Produkční vybere období a studio, pak přidává
 * volná okna — buď zkratkou (nejčastější frekvence 9–13 a 13–17), nebo
 * ručně zadaným časem. Termínů může nabídnout víc, než kolik jich herec
 * potřebuje; to je smysl nabídky.
 */
export function OfferBuilder({
  request,
  slots,
  occupancy,
  presets,
  studios,
  historie,
}: {
  request: Request;
  slots: Slot[];
  occupancy: Obsazeno[];
  presets: Preset[];
  studios: { id: string; name: string }[];
  historie: { id: string; type: string; actorLabel: string; note: string | null; createdAt: string }[];
}) {
  const router = useRouter();
  const locked = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(request.status);

  const [form, setForm] = useState({
    studioId: request.studioId,
    requiredSessions: request.requiredSessions,
    sessionMinutes: request.sessionMinutes,
    periodFrom: request.periodFrom,
    periodTo: request.periodTo,
    note: request.note,
  });
  const [den, setDen] = useState(request.periodFrom);
  const [od, setOd] = useState('9:00');
  const [doo, setDoo] = useState('13:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState(false);

  const nabidnute = slots.filter((s) => s.state === 'OFFERED');
  const vybrane = slots.filter((s) => s.state === 'SELECTED' || s.state === 'CONFIRMED');

  /** Dny období — z nich se skládá nabídka po zkratkách. */
  const dny = useMemo(() => {
    const seznam: string[] = [];
    const konec = new Date(`${request.periodTo}T12:00:00.000Z`);
    const d = new Date(`${request.periodFrom}T12:00:00.000Z`);
    let pojistka = 0;
    while (d <= konec && pojistka < 200) {
      seznam.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
      pojistka += 1;
    }
    return seznam;
  }, [request.periodFrom, request.periodTo]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setInfo(null);
  }

  async function ulozParametry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setInfo('Uloženo.');
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setBusy(false);
    }
  }

  /** Přidá termín. `force` projde i přes upozornění (víkend, mimo dobu). */
  async function pridej(startIso: string, endIso: string, force = false) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}/terminy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', start: startIso, end: endIso, force }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Termín se nepodařilo přidat.');
        return;
      }
      if (data?.needsConfirm) {
        // Vikend nebo mimo pracovni dobu - zeptame se a pak posleme znovu.
        if (window.confirm(`${data.warning}\n\nPřidat termín i tak?`)) {
          await pridej(startIso, endIso, true);
        }
        return;
      }
      router.refresh();
    } catch {
      setError('Termín se nepodařilo přidat.');
    } finally {
      setBusy(false);
    }
  }

  async function odeber(slotId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}/terminy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', slotId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Termín se nepodařilo odebrat.');
        return;
      }
      router.refresh();
    } catch {
      setError('Termín se nepodařilo odebrat.');
    } finally {
      setBusy(false);
    }
  }

  async function odesli() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}/odeslat`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Odeslání se nezdařilo.');
        return;
      }
      setInfo(`Nabídka odešla na ${request.actorEmail}.`);
      router.refresh();
    } catch {
      setError('Odeslání se nezdařilo.');
    } finally {
      setBusy(false);
    }
  }

  async function zrus() {
    if (!window.confirm('Opravdu zrušit celou nabídku? Termíny se uvolní.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Zrušení se nezdařilo.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** Je okno volné? Kontroluje se i tady, aby zkratka nenabízela obsazené časy. */
  function volno(startIso: string, endIso: string): boolean {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const obsazene = [...occupancy, ...slots.map((s) => ({ start: s.start, end: s.end }))];
    return !obsazene.some((o) => overlaps(start, end, new Date(o.start), new Date(o.end)));
  }

  function isoZDne(denKey: string, minuty: number): string {
    const [y, m, d] = denKey.split('-').map(Number);
    return zonedToUtc(y, m, d, minuty, request.timezone).toISOString();
  }

  function parsujCas(hodnota: string): number | null {
    const shoda = hodnota.trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!shoda) return null;
    const h = Number(shoda[1]);
    const m = Number(shoda[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:opacity-60';

  return (
    <div className="flex flex-col gap-6">
      {/* Hlavicka */}
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Nabídka termínů</p>
            <h1 className="font-display text-2xl sm:text-3xl text-ink m-0 mt-0.5">{request.projectName}</h1>
            <p className="text-sm font-body text-muted m-0 mt-1">
              {request.actorName} · {request.studioName}
              {request.pageCount ? ` · ${request.pageCount} NS` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                RECORDING_STATUS_CLASSES[request.status] ?? 'bg-field text-muted'
              }`}
            >
              {RECORDING_STATUS_LABELS[request.status] ?? request.status}
            </span>
            {!locked && (
              <button
                type="button"
                onClick={odesli}
                disabled={busy || nabidnute.length < form.requiredSessions}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
              >
                {request.sentAt ? 'Poslat znovu' : 'Odeslat herci'}
              </button>
            )}
            {!locked && (
              <button type="button" onClick={zrus} disabled={busy} className="text-muted text-sm font-heading px-2">
                Zrušit nabídku
              </button>
            )}
          </div>
        </div>

        {/* Pocitadlo */}
        <div className="flex items-center gap-6 flex-wrap border-t border-line pt-4">
          <span className="flex items-baseline gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Potřeba frekvencí</span>
            <span className="font-display text-2xl text-ink tabular-nums">{form.requiredSessions}</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Nabídnuto</span>
            <span
              className={`font-display text-2xl tabular-nums ${
                nabidnute.length >= form.requiredSessions ? 'text-status-done' : 'text-status-progress'
              }`}
            >
              {nabidnute.length}
            </span>
          </span>
          {vybrane.length > 0 && (
            <span className="flex items-baseline gap-2">
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Herec vybral</span>
              <span className="font-display text-2xl text-ink tabular-nums">{vybrane.length}</span>
            </span>
          )}
          {request.holdUntil && (
            <span className="text-xs font-body text-status-progress">
              Termíny drženy do {formatDateTime(request.holdUntil, request.timezone)}
            </span>
          )}
        </div>

        {request.actorNote && (
          <p className="text-sm font-body text-ink bg-field border border-line rounded-lg px-3 py-2 m-0">
            <strong>Poznámka herce:</strong> {request.actorNote}
          </p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
        {info && <p className="text-sm text-ink bg-[#E3F9EC] border border-line rounded-lg px-3 py-2 m-0">{info}</p>}

        {/* Odkaz pro herce */}
        <div className="flex items-center gap-3 flex-wrap border-t border-line pt-4">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Odkaz pro herce</span>
          <code className="text-xs font-body text-muted bg-field rounded-lg px-3 py-1.5 break-all flex-1 min-w-[240px]">
            {request.offerUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(request.offerUrl);
              setZkopirovano(true);
              setTimeout(() => setZkopirovano(false), 2000);
            }}
            className="text-xs font-heading font-semibold text-brand-purple"
          >
            {zkopirovano ? 'Zkopírováno' : 'Kopírovat'}
          </button>
        </div>
      </div>

      {/* Parametry */}
      {!locked && (
        <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Parametry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Studio</span>
              <select value={form.studioId} onChange={(e) => set('studioId', e.target.value)} className={inputClass}>
                {studios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Období od</span>
              <input type="date" value={form.periodFrom} onChange={(e) => set('periodFrom', e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Období do</span>
              <input type="date" value={form.periodTo} onChange={(e) => set('periodTo', e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Počet frekvencí</span>
              <input
                type="number"
                min={1}
                value={form.requiredSessions}
                onChange={(e) => set('requiredSessions', Number(e.target.value) || 1)}
                className={`${inputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Délka (minuty)</span>
              <input
                type="number"
                min={30}
                step={30}
                value={form.sessionMinutes}
                onChange={(e) => set('sessionMinutes', Number(e.target.value) || 240)}
                className={`${inputClass} tabular-nums`}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Poznámka pro herce</span>
            <input value={form.note} onChange={(e) => set('note', e.target.value)} className={inputClass} />
          </label>
          <div>
            <button
              type="button"
              onClick={ulozParametry}
              disabled={busy}
              className="rounded-lg border border-line px-5 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors disabled:opacity-60"
            >
              Uložit parametry
            </button>
            <span className="text-xs font-body text-muted ml-3">
              Změna studia zruší už nabídnuté termíny — patřily jinému kalendáři.
            </span>
          </div>
        </div>
      )}

      {/* Pridavani terminu */}
      {!locked && (
        <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Nabídnout termíny
          </h2>

          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Den</span>
              <select value={den} onChange={(e) => setDen(e.target.value)} className={inputClass}>
                {dny.map((d) => (
                  <option key={d} value={d}>
                    {new Intl.DateTimeFormat('cs-CZ', {
                      timeZone: request.timezone,
                      weekday: 'short',
                      day: 'numeric',
                      month: 'numeric',
                    }).format(new Date(`${d}T12:00:00.000Z`))}
                  </option>
                ))}
              </select>
            </label>
            {presets.map((p) => {
              const startIso = isoZDne(den, p.startMinutes);
              const endIso = isoZDne(den, p.endMinutes);
              const jeVolno = volno(startIso, endIso);
              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={busy || !jeVolno}
                  onClick={() => pridej(startIso, endIso)}
                  title={jeVolno ? 'Přidat do nabídky' : 'V tomhle čase je studio obsazené'}
                  className="rounded-lg border border-brand-purple px-4 py-2 text-sm font-heading font-semibold text-brand-purple hover:bg-[#F1ECFF] transition-colors disabled:opacity-40 disabled:border-line disabled:text-muted"
                >
                  + {minutesToTime(p.startMinutes)}–{minutesToTime(p.endMinutes)}
                </button>
              );
            })}
          </div>

          <div className="flex items-end gap-2 flex-wrap border-t border-line pt-4">
            <span className="text-xs font-heading text-muted uppercase tracking-wide w-full">Vlastní čas</span>
            <label className="flex flex-col gap-1.5 w-28">
              <span className="text-sm font-body text-ink">Od</span>
              <input value={od} onChange={(e) => setOd(e.target.value)} placeholder="8:00" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 w-28">
              <span className="text-sm font-body text-ink">Do</span>
              <input value={doo} onChange={(e) => setDoo(e.target.value)} placeholder="12:00" className={inputClass} />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const zacatek = parsujCas(od);
                const konec = parsujCas(doo);
                if (zacatek === null || konec === null || konec <= zacatek) {
                  setError('Čas zadejte ve tvaru 8:00 a konec musí být po začátku.');
                  return;
                }
                void pridej(isoZDne(den, zacatek), isoZDne(den, konec));
              }}
              className="rounded-lg border border-line px-4 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors disabled:opacity-60"
            >
              Přidat
            </button>
          </div>
        </div>
      )}

      {/* Seznam terminu */}
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Termíny v nabídce <span className="tabular-nums">({slots.length})</span>
        </h2>
        {slots.length === 0 && (
          <p className="text-sm font-body text-muted m-0">Zatím žádný termín. Přidejte je nahoře.</p>
        )}
        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
          {slots.map((s) => {
            const start = new Date(s.start);
            const end = new Date(s.end);
            return (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-heading font-semibold text-ink">
                    {new Intl.DateTimeFormat('cs-CZ', {
                      timeZone: request.timezone,
                      weekday: 'long',
                      day: 'numeric',
                      month: 'numeric',
                    }).format(start)}
                  </span>
                  <span className="block text-xs font-body text-muted tabular-nums">
                    {minutesToTime(minutesInZone(start, request.timezone))}–
                    {minutesToTime(minutesInZone(end, request.timezone))}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-heading font-semibold text-muted">
                    {SLOT_STATE_LABELS[s.state] ?? s.state}
                  </span>
                  {!locked && s.state === 'OFFERED' && (
                    <button
                      type="button"
                      onClick={() => odeber(s.id)}
                      disabled={busy}
                      className="text-xs font-heading font-semibold text-red-600 disabled:opacity-60"
                    >
                      Odebrat
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Historie */}
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Historie</h2>
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {historie.map((e) => (
            <li key={e.id} className="text-xs font-body text-muted">
              <span className="tabular-nums">{formatDateTime(e.createdAt, request.timezone)}</span>
              {' · '}
              <span className="font-heading text-ink">{e.actorLabel}</span>
              {' · '}
              {e.type}
              {e.note ? ` — ${e.note}` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
