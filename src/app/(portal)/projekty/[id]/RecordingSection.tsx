'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RECORDING_STATUS_CLASSES, RECORDING_STATUS_LABELS, formatDateTime } from '@/lib/calendar';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import { mestoStudia, posledniDenFrekvence } from '@/lib/volnaMista';
import { VyberStudii } from '@/components/VyberStudii';

type Nabidka = {
  id: string;
  actorName: string;
  studioName: string;
  requiredSessions: number;
  offeredCount: number;
  selectedCount: number;
  confirmedCount: number;
  status: string;
  createdAt: string;
};

/**
 * Natáčecí frekvence na projektové kartě (zadani 8. 9. 2026). Ukazuje, kolik
 * frekvencí je podle normostran potřeba, a nechá z projektu založit nabídku
 * termínů pro konkrétního herce.
 *
 * Kniha dělená mezi víc herců má víc nabídek — každou se svým počtem
 * normostran, proto se dá založit opakovaně.
 */
export function RecordingSection({
  caflouProjectId,
  projectName,
  companyId,
  pageCount,
  sessionsFromPages,
  narratorFromCaflou,
  herci,
  studios,
  defaultActorUserId,
  datumOdevzdani,
  requests,
  canManage,
}: {
  caflouProjectId: string;
  projectName: string;
  companyId: string | null;
  pageCount: number | null;
  sessionsFromPages: number;
  narratorFromCaflou: string | null;
  herci: { id: string; label: string }[];
  studios: { id: string; name: string }[];
  defaultActorUserId: string | null;
  /**
   * Datum dokončení projektu „YYYY-MM-DD" (Do kdy to máme odevzdat). Z něj se
   * vymezí poslední možná frekvence (zadání 19. 9. 2026).
   */
  datumOdevzdani: string | null;
  requests: Nabidka[];
  canManage: boolean;
}) {
  const router = useRouter();
  // Dnesek se uz nenabizi - obdobi zacina zitra.
  const zitra = new Date(Date.now() + 24 * 3600 * 1000);
  const zaMesic = new Date();
  zaMesic.setMonth(zaMesic.getMonth() + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    actorUserId: defaultActorUserId ?? '',
    studioId: studios[0]?.id ?? '',
    requiredSessions: Math.max(1, sessionsFromPages),
    pageCount: pageCount ?? 0,
    periodFrom: zitra.toISOString().slice(0, 10),
    // Posledni mozna frekvence = dva dny pred dokoncenim. Bez data
    // dokonceni mesic dopredu.
    periodTo: datumOdevzdani ? posledniDenFrekvence(datumOdevzdani) : zaMesic.toISOString().slice(0, 10),
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Zaškrtnutá studia (19. 9. 2026). Předvyplní se první studio a všechna
   * ve stejném městě - v Brně tedy rovnou obě brněnská.
   */
  const [studioIds, setStudioIds] = useState<string[]>(() => {
    const prvni = studios[0];
    if (!prvni) return [];
    return studios.filter((s) => mestoStudia(s) === mestoStudia(prvni)).map((s) => s.id);
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /**
   * NÁHLED VOLNÝCH MÍST V TOMTÉŽ OKNĚ (zadání 19. 9. 2026: „nelíbí se mi,
   * jak je to plánování na dva kroky… vše by mohlo být přehledně v jednom
   * okně"). Přepočítá se chvilku po každé změně studií, období nebo herce -
   * produkce hned vidí, z kolika míst bude herec vybírat, a pošle mu to
   * jedním tlačítkem.
   */
  type Misto = { studio: string; timezone: string; start: string; end: string; vikend: boolean };
  const [nahled, setNahled] = useState<{ pocet: number; mista: Misto[] } | null>(null);
  const [nacitaNahled, setNacitaNahled] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!open || studioIds.length === 0 || !form.periodFrom || !form.periodTo) return;
    let zruseno = false;
    setNacitaNahled(true);
    const casovac = setTimeout(async () => {
      try {
        const res = await fetch('/api/kalendar/nabidky/nahled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorUserId: form.actorUserId || undefined,
            studioIds,
            periodFrom: form.periodFrom,
            periodTo: form.periodTo,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!zruseno) setNahled(res.ok && data ? data : null);
      } catch {
        if (!zruseno) setNahled(null);
      } finally {
        if (!zruseno) setNacitaNahled(false);
      }
    }, 350);
    return () => {
      zruseno = true;
      clearTimeout(casovac);
    };
  }, [open, studioIds, form.periodFrom, form.periodTo, form.actorUserId]);

  /** Místa po dnech - do přehledu v okně. */
  const podleDnu = useMemo(() => {
    const mapa = new Map<string, Misto[]>();
    for (const m of nahled?.mista ?? []) {
      const den = new Intl.DateTimeFormat('en-CA', { timeZone: m.timezone }).format(new Date(m.start));
      if (!mapa.has(den)) mapa.set(den, []);
      mapa.get(den)!.push(m);
    }
    return Array.from(mapa.entries());
  }, [nahled]);

  const casMista = (m: Misto) => {
    const f = (iso: string) =>
      new Intl.DateTimeFormat('cs-CZ', { timeZone: m.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
    return `${f(m.start)}–${f(m.end)}`;
  };
  const kratkeStudio = (nazev: string) => (nazev.split(' - ').pop() ?? nazev).trim();
  const malo = nahled !== null && nahled.pocet < form.requiredSessions;

  async function zaloz(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/kalendar/nabidky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caflouProjectId,
          projectName,
          companyId: companyId || undefined,
          actorUserId: form.actorUserId,
          studioId: studioIds[0] ?? form.studioId,
          studioIds,
          pageCount: form.pageCount || undefined,
          requiredSessions: form.requiredSessions,
          periodFrom: form.periodFrom,
          periodTo: form.periodTo,
          note: form.note || undefined,
          // Jeden krok: zalozit a rovnou poslat herci.
          odeslat: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.id
            ? `${data.error || 'Nabídku se nepodařilo odeslat.'} Nabídka je uložená v seznamu výše.`
            : data?.error || 'Nabídku se nepodařilo založit.',
        );
        if (data?.id) router.refresh();
        return;
      }
      setOpen(false);
      setInfo('Nabídka termínů odešla herci e-mailem.');
      router.refresh();
    } catch {
      setError('Nabídku se nepodařilo založit.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Natáčecí frekvence
          </h2>
          <p className="text-sm font-body text-muted m-0 mt-1">
            {pageCount != null && pageCount > 0
              ? `${pageCount} normostran → ${sessionsFromPages} ${sessionsFromPages === 1 ? 'frekvence' : sessionsFromPages < 5 ? 'frekvence' : 'frekvencí'}`
              : 'Normostrany z Caflou nedorazily — počet frekvencí zadejte ručně.'}
            {narratorFromCaflou ? ` · herec podle Caflou: ${narratorFromCaflou}` : ''}
          </p>
        </div>
        {canManage && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors"
          >
            Vytvořit nabídku termínů
          </button>
        )}
      </div>

      {info && (
        <p className="text-sm font-body text-ink bg-okTint border border-line rounded-lg px-3 py-2 m-0">{info}</p>
      )}

      {requests.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line border-t border-line pt-1">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <Link
                  href={`/kalendar/nabidka/${r.id}`}
                  className="block text-sm font-heading font-semibold text-ink hover:text-brand-purple no-underline"
                >
                  {r.actorName}
                </Link>
                <span className="block text-xs font-body text-muted">
                  {r.studioName} · {formatDateTime(r.createdAt)}
                </span>
              </span>
              <span className="flex items-center gap-4 shrink-0">
                <span className="text-xs font-body text-muted tabular-nums">
                  {r.confirmedCount > 0
                    ? `${r.confirmedCount} potvrzeno`
                    : r.selectedCount > 0
                      ? `vybráno ${r.selectedCount} z ${r.requiredSessions}`
                      : `nabídnuto ${r.offeredCount} · potřeba ${r.requiredSessions}`}
                </span>
                <span
                  className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                    RECORDING_STATUS_CLASSES[r.status] ?? 'bg-field text-muted'
                  }`}
                >
                  {RECORDING_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {requests.length === 0 && !open && (
        <p className="text-sm font-body text-muted m-0">
          K projektu zatím žádná nabídka termínů není.
        </p>
      )}

      {open && (
        <form onSubmit={zaloz} className="flex flex-col gap-4 border-t border-line pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Herec</span>
              <VyberPole
                required
                value={form.actorUserId}
                onChange={(e) => set('actorUserId', e.target.value)}
                className={inputClass}
              >
                <option value="">— vyberte herce —</option>
                {herci.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </VyberPole>
              <span className="text-xs font-body text-muted">
                Volba se u projektu zapamatuje — v Caflou je herec jen text.
              </span>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Studia</span>
              <VyberStudii studia={studios} vybrana={studioIds} onZmena={setStudioIds} />
              <span className="text-xs font-body text-muted">
                Herci se nabídnou volná místa ve všech zaškrtnutých studiích.
              </span>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Normostrany pro tohoto herce</span>
              <input
                type="number"
                min={0}
                value={form.pageCount}
                onChange={(e) => {
                  const ns = Number(e.target.value) || 0;
                  setForm((f) => ({ ...f, pageCount: ns }));
                }}
                className={`${inputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Počet frekvencí</span>
              <input
                type="number"
                min={1}
                required
                value={form.requiredSessions}
                onChange={(e) => set('requiredSessions', Number(e.target.value) || 1)}
                className={`${inputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">První frekvence nejdříve</span>
              <DatumPole
                required
                value={form.periodFrom}
                onChange={(e) => set('periodFrom', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Poslední frekvence nejpozději</span>
              <DatumPole
                required
                value={form.periodTo}
                onChange={(e) => set('periodTo', e.target.value)}
                className={inputClass}
              />
              <span className="text-xs font-body text-muted">
                {datumOdevzdani
                  ? 'Dva dny před datem dokončení - ať stihneme odevzdat.'
                  : 'Projekt nemá datum dokončení - zadejte ručně.'}
              </span>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Poznámka pro herce</span>
            <input value={form.note} onChange={(e) => set('note', e.target.value)} className={inputClass} />
          </label>

          {/* Nahled - co herec dostane (19. 9. 2026). */}
          <div className="rounded-card border border-line bg-field p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-sm font-heading font-semibold text-ink">
                Volná místa k nabídnutí:{' '}
                <span className={`tabular-nums ${malo ? 'text-status-progress' : 'text-status-done'}`}>
                  {nacitaNahled && !nahled ? '…' : (nahled?.pocet ?? 0)}
                </span>
                <span className="text-muted font-body font-normal"> · herec vybere {form.requiredSessions}</span>
              </span>
              {nacitaNahled && <span className="text-xs font-body text-muted">Počítám…</span>}
            </div>
            {malo && (
              <p className="text-sm font-body text-ink bg-warnTint border border-line rounded-lg px-3 py-2 m-0">
                Volných míst je méně, než herec potřebuje. Posuňte období nebo zaškrtněte další studio.
              </p>
            )}
            {podleDnu.length > 0 && (
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {podleDnu.map(([den, mista]) => (
                  <div key={den} className="flex items-baseline gap-3 text-xs font-body">
                    <span className="w-24 shrink-0 font-heading font-semibold text-ink capitalize tabular-nums">
                      {new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(
                        new Date(`${den}T12:00:00.000Z`),
                      )}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {mista.map((m) => (
                        <span
                          key={`${m.studio}-${m.start}`}
                          className={`rounded-pill px-2 py-0.5 tabular-nums ${
                            m.vikend ? 'bg-warnTint text-ink' : 'bg-surface text-ink border border-line'
                          }`}
                          title={m.vikend ? 'Víkend – po domluvě' : undefined}
                        >
                          {casMista(m)}
                          {studioIds.length > 1 ? ` · ${kratkeStudio(m.studio)}` : ''}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || malo || !form.actorUserId || studioIds.length === 0}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {busy ? 'Odesílám…' : 'Odeslat herci'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
              Zavřít
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
