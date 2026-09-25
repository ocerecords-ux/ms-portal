'use client';

import { useState } from 'react';
import { DatumPole } from '@/components/DatumPole';
import { useRouter } from 'next/navigation';
import { VyberProjektu } from '@/app/(portal)/components/VyberProjektu';
import { formatCzk, formatDuration, durationMinutes, parseTime } from '@/lib/timesheets';

/**
 * NABÍDKA VÝKAZU Z KALENDÁŘE (zadání 20. 9. 2026: „nastavit to nabídnutí
 * výkazu zvukařům po skončené frekvenci… místo Zapsat dej Přidat výkaz").
 *
 * Nahoře ve Výkazech stojí karta se vším, co zvukaři v kalendáři skončilo
 * (nabízí se 5 minut před koncem) a ještě není ve výkazu. Jedno kliknutí na
 * **Přidat výkaz** z toho udělá řádek výkazu s časem a projektem z kalendáře;
 * **Upravit čas** rozbalí datum a čas přímo v řádku (natáčení málokdy skončí
 * přesně), **Nevykazovat** nabídku odloží, aby nešla pořád dokola.
 *
 * Projekt chybí jen u střihu zapsaného bez projektu - tam se musí vybrat,
 * jinak by výkaz neprošel (projekt je povinný u všeho kromě „Ostatní").
 */
export type Navrh = {
  id: string;
  start: string;
  end: string;
  workType: 'RECORDING' | 'EDITING' | 'OTHER';
  caflouProjectId: string | null;
  projectName: string | null;
  studioName: string | null;
  actorName: string | null;
};

type Projekt = { id: string; label: string; dokonceny?: boolean };

const PRAHA = 'Europe/Prague';

function den(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PRAHA,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(new Date(iso));
}

function cas(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PRAHA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function datumProPole(iso: string): string {
  const casti = new Intl.DateTimeFormat('en-CA', {
    timeZone: PRAHA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const v = (t: string) => casti.find((c) => c.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

/** Ikona druhu práce - stejná sada koleček jako v kalendáři. */
function Ikona({ druh }: { druh: Navrh['workType'] }) {
  const strih = druh === 'EDITING';
  return (
    <span
      className={`w-9 h-9 shrink-0 inline-grid place-items-center rounded-pill ${
        strih
          ? 'bg-brand-green/15 text-brand-greenDeep dark:text-brand-green'
          : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
      }`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {strih ? (
          <>
            <path d="M3 10.5v3M6 7.5v9M9 9.5v5" />
            <path d="M15 8.5v7M18 6v12M21 10.5v3" />
            <path d="M12 2.5v2.5M12 8v2.5M12 13.5v2.5M12 19v2.5" strokeWidth="1.4" />
          </>
        ) : (
          <>
            <rect x="8" y="2.5" width="8" height="12" rx="4" />
            <path d="M8 6.5h8M8 10.5h8" />
            <path d="M12 14.5v4M8.5 21.5h7" />
          </>
        )}
      </svg>
    </span>
  );
}

export function NavrhyZKalendare({
  navrhy,
  projekty,
  hourlyRate,
}: {
  navrhy: Navrh[];
  projekty: Projekt[];
  hourlyRate: number;
}) {
  const router = useRouter();
  const [upravovany, setUpravovany] = useState<string | null>(null);
  const [pole, setPole] = useState<{ date: string; from: string; to: string; projektId: string }>({
    date: '',
    from: '',
    to: '',
    projektId: '',
  });
  const [bezi, setBezi] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  if (navrhy.length === 0) return null;

  function otevriUpravu(n: Navrh) {
    setChyba(null);
    setUpravovany(n.id);
    setPole({
      date: datumProPole(n.start),
      from: cas(n.start),
      to: cas(n.end),
      projektId: n.caflouProjectId ?? '',
    });
  }

  async function posli(n: Navrh, akce: 'pridat' | 'odmitnout', sUpravou = false) {
    setBezi(n.id);
    setChyba(null);
    try {
      const projekt = projekty.find((p) => p.id === (sUpravou ? pole.projektId : n.caflouProjectId ?? ''));
      const res = await fetch('/api/vykazy-navrhy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: n.id,
          akce,
          ...(sUpravou
            ? {
                date: pole.date,
                from: pole.from,
                to: pole.to,
                caflouProjectId: pole.projektId || undefined,
                projectName: projekt?.label.split(' — ')[0] || undefined,
              }
            : {}),
          ...(!sUpravou && !n.projectName && projekt
            ? { caflouProjectId: projekt.id, projectName: projekt.label.split(' — ')[0] }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Nepodařilo se to uložit.');
        return;
      }
      setUpravovany(null);
      router.refresh();
    } finally {
      setBezi(null);
    }
  }

  /** Přidat všechny naráz - jen ty, které mají projekt a nejsou rozeditované. */
  async function pridejVse() {
    setChyba(null);
    for (const n of navrhy) {
      if (!n.projectName && n.workType !== 'OTHER') continue;
      setBezi(n.id);
      try {
        const res = await fetch('/api/vykazy-navrhy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: n.id, akce: 'pridat' }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setChyba(data?.error || 'Některé nabídky se nepodařilo přidat.');
        }
      } finally {
        setBezi(null);
      }
    }
    router.refresh();
  }

  const sProjektem = navrhy.filter((n) => n.projectName || n.workType === 'OTHER').length;
  const castka = (n: Navrh) => {
    const minut = durationMinutes(
      parseTime(cas(n.start)) ?? 0,
      parseTime(cas(n.end)) ?? 0,
    );
    return { minut, castka: Math.round((minut / 60) * hourlyRate) };
  };

  return (
    <section className="bg-surface rounded-card border border-brand-purple shadow-sm p-5 sm:p-6 flex flex-col gap-3">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="w-9 h-9 shrink-0 inline-grid place-items-center rounded-pill bg-brand-purple/15 text-brand-purpleDeep dark:text-brand-purpleLight">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 10h17M8 3.5v3M16 3.5v3M9 14.5l2 2 4-4" />
          </svg>
        </span>
        <div className="mr-auto">
          <p className="font-heading font-semibold text-ink m-0 text-base">Z kalendáře čeká na zapsání</p>
          <p className="text-sm font-body text-muted m-0 mt-0.5">
            {navrhy.length === 1
              ? 'Jedna práce, u které jste byl zvukař, už skončila. Zkontrolujte čas a přidejte výkaz.'
              : `${navrhy.length} prací, u kterých jste byl zvukař, už skončilo. Zkontrolujte čas a přidejte výkaz.`}
          </p>
        </div>
        {sProjektem > 1 && (
          <button
            type="button"
            onClick={() => void pridejVse()}
            disabled={Boolean(bezi)}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep disabled:opacity-60"
          >
            Přidat všechny ({sProjektem})
          </button>
        )}
      </div>

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}

      <ul className="list-none m-0 p-0 flex flex-col gap-2">
        {navrhy.map((n) => {
          const upravuje = upravovany === n.id;
          const { minut, castka: kolik } = castka(n);
          // „Ostatní" (casting bez projektu) projekt nepotřebuje.
          const chybiProjekt = !n.projectName && n.workType !== 'OTHER';
          return (
            <li
              key={n.id}
              className="rounded-lg border border-brand-purple/40 bg-brand-purple/[0.05] px-3 py-2.5 flex flex-col gap-2"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <Ikona druh={n.workType} />
                <div className="min-w-[200px] mr-auto">
                  <p className="m-0 font-heading font-semibold text-ink">
                    {n.projectName ?? (n.workType === 'EDITING' ? 'Střih' : n.actorName ? 'Casting' : 'Natáčení')}
                    {n.actorName ? ` — ${n.actorName}` : ''}
                  </p>
                  <p className="m-0 text-xs font-body text-muted">
                    {[n.studioName, n.workType === 'EDITING' ? 'střih' : 'natáčení'].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!upravuje && (
                  <div className="min-w-[170px]">
                    <p className="m-0 font-heading font-semibold text-ink tabular-nums">
                      {den(n.start)} · {cas(n.start)}–{cas(n.end)}
                    </p>
                    <p className="m-0 text-xs font-body text-muted tabular-nums">
                      {formatDuration(minut)} · {formatCzk(kolik)}
                    </p>
                  </div>
                )}
                {upravuje && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <DatumPole
                      value={pole.date}
                      onChange={(e) => setPole({ ...pole, date: e.target.value })}
                      className="rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm font-body text-ink tabular-nums"
                    />
                    <input
                      type="time"
                      step={900}
                      value={pole.from}
                      onChange={(e) => setPole({ ...pole, from: e.target.value })}
                      className="rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm font-body text-ink tabular-nums"
                    />
                    <input
                      type="time"
                      step={900}
                      value={pole.to}
                      onChange={(e) => setPole({ ...pole, to: e.target.value })}
                      className="rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm font-body text-ink tabular-nums"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {upravuje ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void posli(n, 'pridat', true)}
                        disabled={bezi === n.id || (chybiProjekt && !pole.projektId)}
                        className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-3.5 py-1.5 disabled:opacity-60"
                      >
                        {bezi === n.id ? 'Ukládám…' : 'Přidat výkaz'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpravovany(null)}
                        className="text-xs font-heading text-muted underline"
                      >
                        Zrušit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => (chybiProjekt ? otevriUpravu(n) : void posli(n, 'pridat'))}
                        disabled={bezi === n.id}
                        className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-3.5 py-1.5 disabled:opacity-60"
                      >
                        {bezi === n.id ? 'Ukládám…' : 'Přidat výkaz'}
                      </button>
                      <button
                        type="button"
                        onClick={() => otevriUpravu(n)}
                        className="rounded-lg border border-line text-ink font-heading font-semibold text-sm px-3 py-1.5 hover:border-brand-purple"
                      >
                        Upravit čas
                      </button>
                      <button
                        type="button"
                        onClick={() => void posli(n, 'odmitnout')}
                        disabled={bezi === n.id}
                        title="Nabídka zmizí a už se nevrátí"
                        className="text-xs font-heading text-muted underline hover:text-danger"
                      >
                        Nevykazovat
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Projekt se vybírá jen tam, kde v kalendáři nebyl (střih bez
                  projektu) - výkaz bez projektu se uložit nedá. */}
              {(upravuje || chybiProjekt) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-body text-muted">
                    {chybiProjekt ? 'V kalendáři nebyl projekt — vyberte ho:' : 'Projekt:'}
                  </span>
                  <div className="min-w-[260px]">
                    <VyberProjektu
                      projekty={projekty}
                      hodnota={pole.projektId || n.caflouProjectId || ''}
                      onZmena={(id) => setPole({ ...pole, projektId: id })}
                      placeholder="Začněte psát název projektu…"
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
