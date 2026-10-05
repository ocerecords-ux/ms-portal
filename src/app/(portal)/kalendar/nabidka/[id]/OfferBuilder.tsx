'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RECORDING_STATUS_CLASSES,
  formatDateTime,
  minutesInZone,
  minutesToTime,
} from '@/lib/calendar';
import { POZNAMKA_VIKEND } from '@/lib/volnaMista';
import { formatDatum, kodJazyka, prelozitKolem } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
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

type Slot = {
  id: string;
  /** Studio termínu - spolu s časem tvoří klíč místa (viz klicMista). */
  studioId: string;
  start: string;
  end: string;
  state: string;
  studioName: string;
  note: string | null;
  /** Žádost herce o přesun za termín odevzdání (19. 9. 2026). */
  zadost?: { start: string; end: string } | null;
};

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
/**
 * Kolik volných míst chybí. Čeština má tři tvary, takže jsou ve slovníku tři
 * CELÉ VĚTY (pravidlo 7 v docs/preklad-portalu.md) - ne slovo skládané do věty.
 */
function klicChybiMist(n: number): string {
  if (n === 1) return 'nabidkaTerminu.chybiJedno';
  if (n >= 2 && n <= 4) return 'nabidkaTerminu.chybiMalo';
  return 'nabidkaTerminu.chybiVic';
}

/**
 * Stav nabídky a stav termínu ve slovníku. RECORDING_STATUS_LABELS
 * a SLOT_STATE_LABELS v lib/calendar.ts jsou jen česky - tady se překládá
 * podle KÓDU stavu, ne podle jeho popisku.
 */
const KLICE_STAVU: Record<string, string> = {
  DRAFT: 'nabidkaTerminu.stavDraft',
  PREPARING: 'nabidkaTerminu.stavPreparing',
  SENT: 'nabidkaTerminu.stavSent',
  PICKING: 'nabidkaTerminu.stavPicking',
  SUBMITTED: 'nabidkaTerminu.stavSubmitted',
  RETURNED: 'nabidkaTerminu.stavReturned',
  REJECTED: 'nabidkaTerminu.stavRejected',
  CONFIRMED: 'nabidkaTerminu.stavConfirmed',
  CANCELLED: 'nabidkaTerminu.stavCancelled',
  COMPLETED: 'nabidkaTerminu.stavCompleted',
};

const KLICE_STAVU_TERMINU: Record<string, string> = {
  OFFERED: 'nabidkaTerminu.terminNabidnuto',
  SELECTED: 'nabidkaTerminu.terminDrzeno',
  CONFIRMED: 'nabidkaTerminu.terminPotvrzeno',
  RELEASED: 'nabidkaTerminu.terminUvolneno',
  CANCELLED: 'nabidkaTerminu.terminZruseno',
};

export function OfferBuilder({
  request,
  slots,
  vyrazena,
  studiaNabidky,
  studios,
  historie,
}: {
  request: Request;
  slots: Slot[];
  /** Klíče termínů, které produkce z nabídky ručně vyhodila (1. 10. 2026). */
  vyrazena: string[];
  /** Studia, ze kterých se nabízí - lokace herce plus studio nabídky. */
  studiaNabidky: string[];
  studios: { id: string; name: string; color?: string | null }[];
  historie: { id: string; type: string; actorLabel: string; note: string | null; createdAt: string }[];
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
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

  /**
   * ODEBRÁNÍ TERMÍNU Z NABÍDKY (zadání 1. 10. 2026 od Heleny: „posílám termín
   * Richardovi a chtěla jsem mu poslat nabídku až do ledna, ale ty termíny
   * nereflektují Vánoce a silvestr").
   *
   * Klíč musí být TENTÝŽ, který skládá klicMista na serveru - jinak by se
   * vyhozený termín při obnově nabídky vrátil.
   */
  const klicSlotu = (s: Slot) => `${s.studioId}|${s.start}|${s.end}`;

  async function zmenVyrazeni(telo: { vyradit: string } | { vratit: string }) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Termín se nepodařilo změnit.');
        return;
      }
      router.refresh();
    } catch {
      setError('Termín se nepodařilo změnit.');
    } finally {
      setBusy(false);
    }
  }

  /** „út 24. 12. · 9:00–13:00" z klíče místa, ať jde vrátit i bez termínu. */
  function popisKlice(klic: string): string {
    const [, odISO, doISO] = klic.split('|');
    if (!odISO || !doISO) return klic;
    const den = new Intl.DateTimeFormat(kodJazyka(jazyk), {
      timeZone: request.timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    }).format(new Date(odISO));
    return `${den} · ${minutesToTime(minutesInZone(new Date(odISO), request.timezone))}–${minutesToTime(
      minutesInZone(new Date(doISO), request.timezone),
    )}`;
  }
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
        setError(data?.error || t('nabidkaTerminu.chybaUlozeni'));
        return;
      }
      setInfo(t('nabidkaTerminu.ulozeno'));
      router.refresh();
    } catch {
      setError(t('nabidkaTerminu.chybaUlozeni'));
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
        setError(data?.error || t('nabidkaTerminu.chybaOdeslani'));
        return;
      }
      setInfo(t('nabidkaTerminu.odeslanoNa', { email: request.actorEmail }));
      router.refresh();
    } catch {
      setError(t('nabidkaTerminu.chybaOdeslani'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * POČET FREKVENCÍ ROVNOU U ODESÍLÁNÍ (připomínka Heleny 2. 10. 2026:
   * „možnost editovat počet frekvencí při odesílání nabídky termínů").
   *
   * Políčko bylo jen dole v Parametrech, přes celou stránku od tlačítka
   * „Odeslat herci" - a právě při odesílání se to mění nejčastěji: produkce
   * vidí, kolik je volných míst, a podle toho počet doladí. Ukládá se po
   * odkliknutí z políčka, ne dalším tlačítkem.
   */
  async function ulozFrekvence() {
    const pocet = Math.min(60, Math.max(1, form.requiredSessions));
    if (pocet !== form.requiredSessions) setForm((f) => ({ ...f, requiredSessions: pocet }));
    if (pocet === request.requiredSessions) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredSessions: pocet }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('nabidkaTerminu.chybaUlozeni'));
        // Zpatky na ulozenou hodnotu - at na obrazovce nesviti cislo,
        // ktere v nabidce neplati.
        setForm((f) => ({ ...f, requiredSessions: request.requiredSessions }));
        return;
      }
      setInfo(t('nabidkaTerminu.ulozeno'));
      router.refresh();
    } catch {
      setError(t('nabidkaTerminu.chybaUlozeni'));
      setForm((f) => ({ ...f, requiredSessions: request.requiredSessions }));
    } finally {
      setBusy(false);
    }
  }

  /**
   * UPOMÍNKA HERCI (připomínka Heleny 2. 10. 2026: „tlačítko na upomenutí
   * herce, aby si naklikal termíny").
   *
   * Není to „Poslat znovu" - ta posílá celou nabídku a přepisuje čas odeslání.
   * Tohle pošle krátkou připomínku s odkazem, zazvoní hercovi v portálu
   * a zapíše se do historie nabídky. Dá se zmáčknout i víckrát.
   */
  async function upomen() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}/upomenout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('nabidkaTerminu.chybaUpominky'));
        return;
      }
      setInfo(t('nabidkaTerminu.upomenutoNa', { email: request.actorEmail }));
      router.refresh();
    } catch {
      setError(t('nabidkaTerminu.chybaUpominky'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Rozhodnutí o výběru herce. Potvrzení je zároveň schválení — mezikrok
   * jsme vypustili (rozhodnuto 8. 9. 2026).
   */
  async function rozhodni(action: 'confirm' | 'return' | 'reject' | 'complete') {
    if (action === 'reject' && !window.confirm(t('nabidkaTerminu.opravduZamitnout'))) return;
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
        setError(data?.error || t('nabidkaTerminu.chybaRozhodnuti'));
        return;
      }
      setVzkaz('');
      setInfo(
        action === 'confirm'
          ? t('nabidkaTerminu.hotovoPotvrzeno')
          : action === 'return'
            ? t('nabidkaTerminu.hotovoVraceno')
            : action === 'reject'
              ? t('nabidkaTerminu.hotovoZamitnuto')
              : t('nabidkaTerminu.hotovoDokonceno'),
      );
      router.refresh();
    } catch {
      setError(t('nabidkaTerminu.chybaRozhodnuti'));
    } finally {
      setBusy(false);
    }
  }

  /** Rozhodnutí o žádosti herce o přesun za termín odevzdání. */
  async function rozhodniPresun(slotId: string, action: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/kalendar/terminy/prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('nabidkaTerminu.chybaRozhodnuti'));
        return;
      }
      setInfo(
        action === 'approve'
          ? t('nabidkaTerminu.presunPotvrzen')
          : t('nabidkaTerminu.presunZamitnut'),
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const zadostiOPresun = slots.filter((s) => s.zadost);
  const kdy = (iso: string) =>
    new Intl.DateTimeFormat(kodJazyka(jazyk), {
      timeZone: request.timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));

  async function zrus() {
    if (!window.confirm(t('nabidkaTerminu.opravduZrusitNabidku'))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kalendar/nabidky/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('nabidkaTerminu.chybaZruseni'));
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
            <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">
              {t('nabidkaTerminu.nadpis')}
            </p>
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
              {KLICE_STAVU[request.status] ? t(KLICE_STAVU[request.status]) : request.status}
            </span>
            {!locked && (
              <button
                type="button"
                onClick={odesli}
                disabled={busy || chybiTerminu > 0}
                title={chybiTerminu > 0 ? t(klicChybiMist(chybiTerminu), { pocet: chybiTerminu }) : undefined}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
              >
                {request.sentAt ? t('nabidkaTerminu.poslatZnovu') : t('nabidkaTerminu.odeslatHerci')}
              </button>
            )}
            {/* Upomínka jen když se na herce opravdu čeká (2. 10. 2026). */}
            {request.sentAt && ['SENT', 'PICKING', 'RETURNED'].includes(request.status) && (
              <button
                type="button"
                onClick={upomen}
                disabled={busy}
                title={t('nabidkaTerminu.upomenoutPopis')}
                className="rounded-lg border border-line px-4 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors disabled:opacity-60"
              >
                {t('nabidkaTerminu.upomenout')}
              </button>
            )}
            {!locked && (
              <button type="button" onClick={zrus} disabled={busy} className="text-muted text-sm font-heading px-2">
                {t('nabidkaTerminu.zrusitNabidku')}
              </button>
            )}
          </div>
        </div>

        {/* Pocitadlo */}
        <div className="flex items-center gap-6 flex-wrap border-t border-line pt-4">
          <span className="flex items-baseline gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('nabidkaTerminu.potrebaFrekvenci')}
            </span>
            {locked ? (
              <span className="font-display text-2xl text-ink tabular-nums">{form.requiredSessions}</span>
            ) : (
              <input
                type="number"
                min={1}
                max={60}
                value={form.requiredSessions}
                disabled={busy}
                onChange={(e) => set('requiredSessions', Number(e.target.value) || 1)}
                onBlur={() => void ulozFrekvence()}
                title={t('nabidkaTerminu.frekvenceRovnou')}
                className="font-display text-2xl text-ink tabular-nums w-16 rounded-lg border border-line bg-field px-2 py-0.5 outline-none focus:border-brand-purple disabled:opacity-60"
              />
            )}
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('nabidkaTerminu.nabidnuto')}
            </span>
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
              <span className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('nabidkaTerminu.herecVybral')}
              </span>
              <span className="font-display text-2xl text-ink tabular-nums">{vybrane.length}</span>
            </span>
          )}
          {request.holdUntil && (
            <span className="text-xs font-body text-status-progress">
              {t('nabidkaTerminu.drzenoDo', {
                datum: formatDateTime(request.holdUntil, request.timezone, jazyk),
              })}
            </span>
          )}
        </div>

        {!locked && (
          <p
            className={`text-sm font-body text-ink border border-line rounded-lg px-3 py-2 m-0 ${
              chybiTerminu > 0 ? 'bg-warnTint' : 'bg-field'
            }`}
          >
            {chybiTerminu > 0
              ? t('nabidkaTerminu.maloMist', {
                  volnych: nabidnute.length,
                  potreba: form.requiredSessions,
                })
              : (() => {
                  // Tučný je jen seznam studií, věta zůstává jeden klíč.
                  const [pred, za] = prelozitKolem(jazyk, 'nabidkaTerminu.dostaneVsechna', 'studia', {
                    pocet: nabidnute.length,
                    datum: formatDatum(jazyk, new Date(`${request.periodTo}T12:00:00.000Z`)),
                    potreba: form.requiredSessions,
                  });
                  return (
                    <>
                      {pred}
                      <strong>{studiaNabidky.join(', ')}</strong>
                      {za}
                    </>
                  );
                })()}
          </p>
        )}

        {request.actorNote && (
          <p className="text-sm font-body text-ink bg-field border border-line rounded-lg px-3 py-2 m-0">
            <strong>{t('nabidkaTerminu.poznamkaHerce')}</strong> {request.actorNote}
          </p>
        )}
        {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
        {info && <p className="text-sm text-ink bg-okTint border border-line rounded-lg px-3 py-2 m-0">{info}</p>}

        {/* Odkaz pro herce */}
        <div className="flex items-center gap-3 flex-wrap border-t border-line pt-4">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {t('nabidkaTerminu.odkazProHerce')}
          </span>
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
            {zkopirovano ? t('obecne.zkopirovano') : t('nabidkaTerminu.kopirovat')}
          </button>
        </div>
      </div>

      {/* Schvalovani vyberu herce */}
      {request.status === 'SUBMITTED' && (
        <div className="bg-surface rounded-card border-2 border-status-progress shadow-sm p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {t('nabidkaTerminu.herecVybralNadpis')}
            </h2>
            <p className="text-sm font-body text-muted m-0 mt-1">
              {t('nabidkaTerminu.vybranoZ', { vybrano: vybrane.length, potreba: request.requiredSessions })}
              {request.holdUntil
                ? ` · ${t('nabidkaTerminu.drzenoDoKratce', {
                    datum: formatDateTime(request.holdUntil, request.timezone, jazyk),
                  })}`
                : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <span className="text-xs font-heading text-status-done uppercase tracking-wide">
                {t('nabidkaTerminu.vybral')}
              </span>
              <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1.5">
                {vybrane.map((s) => (
                  <li key={s.id} className="text-sm font-heading text-ink">
                    <span className="capitalize">
                      {new Intl.DateTimeFormat(kodJazyka(jazyk), {
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
              <span className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('nabidkaTerminu.nevybral')}
              </span>
              <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1.5">
                {nabidnute.length === 0 && (
                  <li className="text-sm font-body text-muted">{t('nabidkaTerminu.vzalVsechny')}</li>
                )}
                {nabidnute.map((s) => (
                  <li key={s.id} className="text-sm font-body text-muted flex items-center gap-2 group">
                    <span className="capitalize">
                      {new Intl.DateTimeFormat(kodJazyka(jazyk), {
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
                    {/* Odebrání termínu z nabídky (1. 10. 2026). Po odeslání
                        herci už se seznamem nehýbeme - ten už si z něj vybírá. */}
                    {!locked && !request.sentAt && (
                      <button
                        type="button"
                        onClick={() => void zmenVyrazeni({ vyradit: klicSlotu(s) })}
                        disabled={busy}
                        title="Odebrat z nabídky"
                        aria-label="Odebrat z nabídky"
                        className="ml-auto text-xs font-heading text-muted hover:text-danger transition-colors disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {vyrazena.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0 mb-2">
                    Odebráno z nabídky ({vyrazena.length})
                  </p>
                  <ul className="list-none m-0 p-0 flex flex-col gap-1">
                    {vyrazena.map((klic) => (
                      <li key={klic} className="text-sm font-body text-muted flex items-center gap-2">
                        <span className="capitalize line-through">{popisKlice(klic)}</span>
                        {!locked && !request.sentAt && (
                          <button
                            type="button"
                            onClick={() => void zmenVyrazeni({ vratit: klic })}
                            disabled={busy}
                            className="ml-auto text-xs font-heading text-brand-purple hover:underline disabled:opacity-50"
                          >
                            Vrátit
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('nabidkaTerminu.vzkazHerci')}</span>
            <input
              value={vzkaz}
              onChange={(e) => setVzkaz(e.target.value)}
              className={inputClass}
              placeholder={t('nabidkaTerminu.vzkazPlaceholder')}
            />
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => rozhodni('confirm')}
              disabled={busy}
              className="bg-solidDone text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {t('nabidkaTerminu.potvrditTerminy')}
            </button>
            <button
              type="button"
              onClick={() => rozhodni('return')}
              disabled={busy}
              className="rounded-lg border border-status-progress px-5 py-2.5 text-sm font-heading font-semibold text-status-progress hover:bg-warnTint transition-colors disabled:opacity-60"
            >
              {t('nabidkaTerminu.vratitKPrepracovani')}
            </button>
            <button
              type="button"
              onClick={() => rozhodni('reject')}
              disabled={busy}
              className="text-danger text-sm font-heading px-2 disabled:opacity-60"
            >
              {t('nabidkaTerminu.zamitnout')}
            </button>
          </div>
        </div>
      )}

      {/* Potvrzeno - zbyva uz jen odtocit */}
      {request.status === 'CONFIRMED' && (
        <div className="bg-okTint border border-line rounded-card p-5 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm font-body text-ink m-0">{t('nabidkaTerminu.potvrzenoPopis')}</span>
          <button
            type="button"
            onClick={() => rozhodni('complete')}
            disabled={busy}
            className="rounded-lg border border-line bg-surface px-5 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors disabled:opacity-60"
          >
            {t('nabidkaTerminu.oznacitDokoncene')}
          </button>
        </div>
      )}

      {/* ŽÁDOSTI HERCE O PŘESUN ZA TERMÍN ODEVZDÁNÍ (19. 9. 2026) */}
      {zadostiOPresun.length > 0 && (
        <div className="bg-warnTint rounded-card border border-status-progress p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-status-progress uppercase tracking-wide m-0">
            {t('nabidkaTerminu.zadostPresunNadpis')}
          </h2>
          <p className="text-sm font-body text-ink m-0">{t('nabidkaTerminu.zadostPresunPopis')}</p>
          {zadostiOPresun.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap bg-surface rounded-lg border border-line px-4 py-3">
              <span className="text-sm font-heading text-ink tabular-nums">
                {kdy(s.start)} <span className="text-muted">→</span> <strong>{kdy(s.zadost!.start)}</strong>
              </span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => rozhodniPresun(s.id, 'approve')}
                  className="bg-solidDone text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-60"
                >
                  {t('nabidkaTerminu.potvrditPresun')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => rozhodniPresun(s.id, 'reject')}
                  className="text-danger text-sm font-heading font-semibold disabled:opacity-60"
                >
                  {t('nabidkaTerminu.zamitnout')}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Parametry */}
      {!locked && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('nabidkaTerminu.parametry')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-5">
              <span className="text-sm font-body text-ink">{t('nabidkaTerminu.studia')}</span>
              <VyberStudii studia={studios} vybrana={form.studioIds} onZmena={(ids) => set('studioIds', ids)} />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('nabidkaTerminu.obdobiOd')}</span>
              <DatumPole value={form.periodFrom} onChange={(e) => set('periodFrom', e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('nabidkaTerminu.posledniFrekvence')}</span>
              <DatumPole value={form.periodTo} onChange={(e) => set('periodTo', e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('nabidkaTerminu.pocetFrekvenci')}</span>
              <input
                type="number"
                min={1}
                value={form.requiredSessions}
                onChange={(e) => set('requiredSessions', Number(e.target.value) || 1)}
                className={`${inputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('nabidkaTerminu.delka')}</span>
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
            <span className="text-sm font-body text-ink">{t('nabidkaTerminu.poznamkaProHerce')}</span>
            <input value={form.note} onChange={(e) => set('note', e.target.value)} className={inputClass} />
          </label>
          <div>
            <button
              type="button"
              onClick={ulozParametry}
              disabled={busy}
              className="rounded-lg border border-line px-5 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors disabled:opacity-60"
            >
              {t('nabidkaTerminu.ulozitParametry')}
            </button>
            <span className="text-xs font-body text-muted ml-3">{t('nabidkaTerminu.poUlozeni')}</span>
          </div>
        </div>
      )}

      {/* Seznam terminu */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('nabidkaTerminu.seznamNadpis')} <span className="tabular-nums">({slots.length})</span>
        </h2>
        {slots.length === 0 && (
          <p className="text-sm font-body text-muted m-0">{t('nabidkaTerminu.zadneVolneMisto')}</p>
        )}
        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line max-h-[28rem] overflow-y-auto">
          {slots.map((s) => {
            const start = new Date(s.start);
            const end = new Date(s.end);
            return (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-heading font-semibold text-ink">
                    {new Intl.DateTimeFormat(kodJazyka(jazyk), {
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
                    {/* Porovnává se s konstantou z lib/volnaMista.ts, ne s napsanou
                        větou - dřív tu byl text natvrdo (dávka 5). */}
                    {s.note && s.note !== POZNAMKA_VIKEND ? ` · ${s.note}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-heading font-semibold text-muted">
                    {KLICE_STAVU_TERMINU[s.state] ? t(KLICE_STAVU_TERMINU[s.state]) : s.state}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Historie */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('nabidkaTerminu.historie')}
        </h2>
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {historie.map((e) => (
            <li key={e.id} className="text-xs font-body text-muted">
              <span className="tabular-nums">{formatDateTime(e.createdAt, request.timezone, jazyk)}</span>
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
