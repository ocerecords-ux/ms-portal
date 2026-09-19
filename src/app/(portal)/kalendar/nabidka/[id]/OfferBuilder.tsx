'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RECORDING_STATUS_CLASSES,
  RECORDING_STATUS_LABELS,
  SLOT_STATE_LABELS,
  formatDateTime,
  minutesInZone,
  minutesToTime,
} from '@/lib/calendar';
import { DatumPole } from '@/components/DatumPole';
import { VyberPole } from '@/components/VyberPole';
import { VyberStudii } from '@/components/VyberStudii';

type Request = {
  id: string;
  caflouProjectId: string;
  projectName: string;
  actorName: string;
  actorEmail: string;
  studioId: string;
  /** Zaškrtnutá studia nabídky (19. 9. 2026). */
  studioIds: string[];
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

type Slot = { id: string; start: string; end: string; state: string; studioName: string; note: string | null };

/**
 * Nabídka termínů. Termíny se NEPŘIDÁVAJÍ RUČNĚ (zadání 19. 9. 2026: „Nechci
 * termíny nabídnout ručně. Prostě když se to spočítá na 7 frekvencí, tak herec
 * musí zakliknout 7 termínů, může vybírat všude tam, kde je místo v rámci jeho
 * lokace a studia"). Nabídka obsahuje všechna volná místa ve studiích herce
 * od začátku období do poslední možné frekvence - počítá je
 * lib/volnaMista.ts a srovnává se s kalendářem při každém otevření.
 *
 * Produkce tu jen upraví parametry (období, počet frekvencí), odešle herci
 * a potvrdí jeho výběr.
 */
/** „1 termín", „2 termíny", „5 termínů" - nebo totéž s „místo". */
function slovoTermin(n: number, misto = false): string {
  if (n === 1) return misto ? 'volné místo' : 'termín';
  if (n >= 2 && n <= 4) return misto ? 'volná místa' : 'termíny';
  return misto ? 'volných míst' : 'termínů';
}

export function OfferBuilder({
  request,
  slots,
  studiaNabidky,
  studios,
  historie,
}: {
  request: Request;
  slots: Slot[];
  /** Studia, ze kterých se nabízí - lokace herce plus studio nabídky. */
  studiaNabidky: string[];
  studios: { id: string; name: string }[];
  historie: { id: string; type: string; actorLabel: string; note: string | null; createdAt: string }[];
}) {
  const router = useRouter();
  const locked = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(request.status);

  const [form, setForm] = useState({
    studioIds: request.studioIds,
    requiredSessions: request.requiredSessions,
    sessionMinutes: request.sessionMinutes,
    periodFrom: request.periodFrom,
    periodTo: request.periodTo,
    note: request.note,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState(false);
  const [vzkaz, setVzkaz] = useState('');

  const nabidnute = slots.filter((s) => s.state === 'OFFERED');
  const vybrane = slots.filter((s) => s.state === 'SELECTED' || s.state === 'CONFIRMED');

  /**
   * Kolik volných míst chybí, aby měl herec z čeho vybrat. Nabídka se skládá
   * sama, takže nedostatek znamená plný kalendář nebo krátké období.
   */
  const chybiTerminu = Math.max(0, form.requiredSessions - nabidnute.length);

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

  /**
   * Rozhodnutí o výběru herce. Potvrzení je zároveň schválení — mezikrok
   * jsme vypustili (rozhodnuto 8. 9. 2026).
   */
  async function rozhodni(action: 'confirm' | 'return' | 'reject' | 'complete') {
    if (action === 'reject' && !window.confirm('Opravdu zamítnout? Termíny se uvolní.')) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}/rozhodnuti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: vzkaz || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Rozhodnutí se nepodařilo uložit.');
        return;
      }
      setVzkaz('');
      setInfo(
        action === 'confirm'
          ? 'Termíny potvrzeny, herci odešel e-mail.'
          : action === 'return'
            ? 'Vráceno herci k novému výběru.'
            : action === 'reject'
              ? 'Výběr zamítnut.'
              : 'Označeno jako dokončené.',
      );
      router.refresh();
    } catch {
      setError('Rozhodnutí se nepodařilo uložit.');
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

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:opacity-60';

  return (
    <div className="flex flex-col gap-6">
      {/* Hlavicka */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
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
                disabled={busy || chybiTerminu > 0}
                title={
                  chybiTerminu > 0
                    ? `V období chybí ${chybiTerminu} ${slovoTermin(chybiTerminu, true)} - prodlužte období.`
                    : undefined
                }
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

        {!locked && (
          <p
            className={`text-sm font-body text-ink border border-line rounded-lg px-3 py-2 m-0 ${
              chybiTerminu > 0 ? 'bg-warnTint' : 'bg-field'
            }`}
          >
            {chybiTerminu > 0 ? (
              <>
                V zadaném období je volných jen{' '}
                <strong className="tabular-nums">{nabidnute.length}</strong> míst, herec jich potřebuje{' '}
                <strong className="tabular-nums">{form.requiredSessions}</strong>. Posuňte v Parametrech začátek nebo
                konec období.
              </>
            ) : (
              <>
                Herec dostane všechna volná místa ({nabidnute.length}) ve studiích{' '}
                <strong>{studiaNabidky.join(', ')}</strong> do{' '}
                {new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(
                  new Date(`${request.periodTo}T12:00:00.000Z`),
                )}{' '}
                a vybere si z nich {form.requiredSessions}. Obsazené časy v kalendáři se vynechávají samy.
              </>
            )}
          </p>
        )}

        {request.actorNote && (
          <p className="text-sm font-body text-ink bg-field border border-line rounded-lg px-3 py-2 m-0">
            <strong>Poznámka herce:</strong> {request.actorNote}
          </p>
        )}
        {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
        {info && <p className="text-sm text-ink bg-okTint border border-line rounded-lg px-3 py-2 m-0">{info}</p>}

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

      {/* Schvalovani vyberu herce */}
      {request.status === 'SUBMITTED' && (
        <div className="bg-surface rounded-card border-2 border-status-progress shadow-sm p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Herec vybral termíny
            </h2>
            <p className="text-sm font-body text-muted m-0 mt-1">
              Vybráno {vybrane.length} z {request.requiredSessions}
              {request.holdUntil ? ` · drženo do ${formatDateTime(request.holdUntil, request.timezone)}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <span className="text-xs font-heading text-status-done uppercase tracking-wide">Vybral</span>
              <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1.5">
                {vybrane.map((s) => (
                  <li key={s.id} className="text-sm font-heading text-ink">
                    <span className="capitalize">
                      {new Intl.DateTimeFormat('cs-CZ', {
                        timeZone: request.timezone,
                        weekday: 'long',
                        day: 'numeric',
                        month: 'numeric',
                      }).format(new Date(s.start))}
                    </span>
                    <span className="text-muted font-body tabular-nums">
                      {' · '}
                      {minutesToTime(minutesInZone(new Date(s.start), request.timezone))}–
                      {minutesToTime(minutesInZone(new Date(s.end), request.timezone))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-xs font-heading text-muted uppercase tracking-wide">Nevybral</span>
              <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1.5">
                {nabidnute.length === 0 && (
                  <li className="text-sm font-body text-muted">— všechny nabídnuté termíny si vzal —</li>
                )}
                {nabidnute.map((s) => (
                  <li key={s.id} className="text-sm font-body text-muted">
                    <span className="capitalize">
                      {new Intl.DateTimeFormat('cs-CZ', {
                        timeZone: request.timezone,
                        weekday: 'short',
                        day: 'numeric',
                        month: 'numeric',
                      }).format(new Date(s.start))}
                    </span>
                    <span className="tabular-nums">
                      {' · '}
                      {minutesToTime(minutesInZone(new Date(s.start), request.timezone))}–
                      {minutesToTime(minutesInZone(new Date(s.end), request.timezone))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Vzkaz herci (u vrácení a zamítnutí se hodí důvod)</span>
            <input
              value={vzkaz}
              onChange={(e) => setVzkaz(e.target.value)}
              className={inputClass}
              placeholder="např. Středu bohužel nestihneme, vyberte prosím jiný den."
            />
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => rozhodni('confirm')}
              disabled={busy}
              className="bg-solidDone text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              Potvrdit termíny
            </button>
            <button
              type="button"
              onClick={() => rozhodni('return')}
              disabled={busy}
              className="rounded-lg border border-status-progress px-5 py-2.5 text-sm font-heading font-semibold text-status-progress hover:bg-warnTint transition-colors disabled:opacity-60"
            >
              Vrátit k přepracování
            </button>
            <button
              type="button"
              onClick={() => rozhodni('reject')}
              disabled={busy}
              className="text-danger text-sm font-heading px-2 disabled:opacity-60"
            >
              Zamítnout
            </button>
          </div>
        </div>
      )}

      {/* Potvrzeno - zbyva uz jen odtocit */}
      {request.status === 'CONFIRMED' && (
        <div className="bg-okTint border border-line rounded-card p-5 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm font-body text-ink m-0">
            Termíny jsou potvrzené a v kalendáři studia. Až se odtočí, můžete nabídku uzavřít.
          </span>
          <button
            type="button"
            onClick={() => rozhodni('complete')}
            disabled={busy}
            className="rounded-lg border border-line bg-surface px-5 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors disabled:opacity-60"
          >
            Označit jako dokončené
          </button>
        </div>
      )}

      {/* Parametry */}
      {!locked && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Parametry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-5">
              <span className="text-sm font-body text-ink">Studia</span>
              <VyberStudii studia={studios} vybrana={form.studioIds} onZmena={(ids) => set('studioIds', ids)} />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Období od</span>
              <DatumPole value={form.periodFrom} onChange={(e) => set('periodFrom', e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Poslední frekvence nejpozději</span>
              <DatumPole value={form.periodTo} onChange={(e) => set('periodTo', e.target.value)} className={inputClass} />
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
              Po uložení se volná místa spočítají znovu - nabízí se ve všech zaškrtnutých studiích.
            </span>
          </div>
        </div>
      )}

      {/* Seznam terminu */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Termíny v nabídce <span className="tabular-nums">({slots.length})</span>
        </h2>
        {slots.length === 0 && (
          <p className="text-sm font-body text-muted m-0">
            V zadaném období není v kalendáři žádné volné místo. Upravte období v Parametrech.
          </p>
        )}
        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line max-h-[28rem] overflow-y-auto">
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
                    {studiaNabidky.length > 1 ? ` · ${s.studioName}` : ''}
                    {s.note ? ` · ${s.note}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-heading font-semibold text-muted">
                    {SLOT_STATE_LABELS[s.state] ?? s.state}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Historie */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
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
