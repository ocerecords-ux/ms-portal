'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DruhNepritomnosti } from '@prisma/client';
import {
  BARVA_NEPRITOMNOSTI,
  DRUHY_NEPRITOMNOSTI,
  PASMO_NEPRITOMNOSTI,
  denVPraze,
  popisDruhu,
  posledniDen,
  rozsahSlovy,
  type NepritomnostVKalendari,
} from '@/lib/nepritomnost';
import { DatumPole } from '@/components/DatumPole';
import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { VyberProjektu } from '@/app/(portal)/components/VyberProjektu';

/**
 * KALENDÁŘ DOVOLENÝCH A NEPŘÍTOMNOSTI - kousky, které se kreslí do kalendáře
 * studií (zadání 19. 9. 2026: „potřebuji jeden kalendář, do kterého si budou
 * lidi psát dovolené a kdy jsou mimo studio. Tam není třeba projekt, jen
 * možnost celodenní události").
 *
 * Dovolená nemá čas v hodinové mřížce - je to celý den, a v mřížce by
 * zabrala sloupec od půlnoci do půlnoci a přikryla natáčení. Proto má vlastní
 * pruh NAD hodinami, jako celodenní události v každém běžném kalendáři.
 * I nepřítomnost na pár hodin („odpoledne u notáře") jde do toho pruhu, jen
 * s časem - v mřížce by se pletla s prací ve studiu.
 */

export type Osoba = { id: string; label: string };

/** Jeden štítek - v pruhu nad mřížkou i v měsíci. */
export function CipNepritomnosti({
  n,
  onOtevri,
}: {
  n: NepritomnostVKalendari;
  onOtevri: (n: NepritomnostVKalendari) => void;
}) {
  const popis = `${n.jmeno} · ${popisDruhu(n.druh)} · ${rozsahSlovy(n)}${n.poznamka ? ` · ${n.poznamka}` : ''}`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (n.muzeUpravit) onOtevri(n);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={n.muzeUpravit ? `${popis}\nKlepnutím upravíte.` : popis}
      className={`w-full rounded px-1.5 py-0.5 text-[10px] font-heading text-left truncate border text-ink ${
        n.muzeUpravit ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
      }`}
      style={{
        backgroundColor: `${BARVA_NEPRITOMNOSTI}33`,
        borderColor: BARVA_NEPRITOMNOSTI,
        borderLeftWidth: '3px',
      }}
    >
      {!n.celyDen && (
        <span className="tabular-nums text-muted">
          {new Intl.DateTimeFormat('cs-CZ', {
            timeZone: PASMO_NEPRITOMNOSTI,
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(n.start))}{' '}
        </span>
      )}
      {n.jmeno}
      <span className="text-muted"> · {popisDruhu(n.druh)}</span>
    </button>
  );
}

/**
 * Pruh celodenních událostí nad hodinovou mřížkou. Dvojklik do prázdného
 * místa dne zapíše nepřítomnost na ten den - stejně jako dvojklik do mřížky
 * zakládá událost ve studiu.
 */
export function PruhNepritomnosti({
  dny,
  podleDnu,
  onOtevri,
  onNova,
}: {
  dny: { key: string }[];
  podleDnu: Map<string, NepritomnostVKalendari[]>;
  onOtevri: (n: NepritomnostVKalendari) => void;
  onNova: (denKey: string) => void;
}) {
  return (
    <div
      className="grid border-b border-line bg-paper/40"
      style={{ gridTemplateColumns: `52px repeat(${dny.length}, 1fr)` }}
    >
      <div
        className="px-1 py-1.5 text-[9px] font-heading text-muted uppercase tracking-wide text-right leading-tight self-center"
        title="Dovolené a mimo studio"
      >
        Pryč
      </div>
      {dny.map((den) => {
        const vDni = podleDnu.get(den.key) ?? [];
        return (
          <div
            key={den.key}
            className="border-l border-line p-1 flex flex-col gap-0.5 min-h-[28px]"
            onDoubleClick={() => onNova(den.key)}
            title={vDni.length === 0 ? 'Dvojklikem zapíšete dovolenou nebo den mimo studio' : undefined}
          >
            {vDni.map((n) => (
              <CipNepritomnosti key={n.id} n={n} onOtevri={onOtevri} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Rozdělí nepřítomnosti do dnů - vícedenní dovolená se ukáže v každém. */
export function rozdelPoDnech(
  dny: { key: string; startIso: string; endIso: string }[],
  nepritomnosti: NepritomnostVKalendari[],
): Map<string, NepritomnostVKalendari[]> {
  // Celodenni se porovnava podle DATA, ne podle okamziku: kdyz se kalendar
  // kresli v pasmu Londyna, zacina prazsky den uz ve 23:00 predchoziho dne
  // a dovolena by jinak presahla i do dne pred ni.
  const rozsahy = nepritomnosti.map((n) => ({
    n,
    prvni: denVPraze(new Date(n.start)),
    posledni: n.celyDen ? posledniDen(n.end) : denVPraze(new Date(n.start)),
  }));
  const mapa = new Map<string, NepritomnostVKalendari[]>();
  for (const den of dny) {
    mapa.set(
      den.key,
      rozsahy.filter((r) => r.prvni <= den.key && den.key <= r.posledni).map((r) => r.n),
    );
  }
  return mapa;
}

function minutyNaCas(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PASMO_NEPRITOMNOSTI,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/**
 * Okno pro zápis a úpravu nepřítomnosti. Schválně krátké: kdo, co, od kdy do
 * kdy. Žádný projekt ani studio - dovolená se týká člověka, ne studia.
 */
export function NepritomnostForm({
  upravovana,
  vychoziDen,
  ja,
  lidiTymu,
  onClose,
}: {
  upravovana: NepritomnostVKalendari | null;
  /** YYYY-MM-DD - den, do kterého se dvojkliklo. */
  vychoziDen: string;
  ja: Osoba;
  /** Za koho jde zapisovat. Prázdné = jen za sebe (není správce kalendáře). */
  lidiTymu: Osoba[];
  onClose: () => void;
}) {
  const router = useRouter();
  const spravce = lidiTymu.length > 0;

  const [kdo, setKdo] = useState(upravovana?.userId ?? ja.id);
  const [druh, setDruh] = useState<DruhNepritomnosti>(upravovana?.druh ?? 'DOVOLENA');
  const [celyDen, setCelyDen] = useState(upravovana?.celyDen ?? true);
  const [od, setOd] = useState(upravovana ? denVPraze(new Date(upravovana.start)) : vychoziDen);
  const [doDen, setDoDen] = useState(
    upravovana ? (upravovana.celyDen ? posledniDen(upravovana.end) : denVPraze(new Date(upravovana.start))) : vychoziDen,
  );
  const [casOd, setCasOd] = useState(
    upravovana && !upravovana.celyDen ? minutyNaCas(new Date(upravovana.start)) : '09:00',
  );
  const [casDo, setCasDo] = useState(
    upravovana && !upravovana.celyDen ? minutyNaCas(new Date(upravovana.end)) : '13:00',
  );
  const [poznamka, setPoznamka] = useState(upravovana?.poznamka ?? '');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const spatnyRozsah = celyDen ? doDen < od : casDo <= casOd;

  async function uloz() {
    if (bezi || spatnyRozsah) return;
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch(
        upravovana ? `/api/kalendar/nepritomnost?id=${upravovana.id}` : '/api/kalendar/nepritomnost',
        {
          method: upravovana ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: spravce ? kdo : undefined,
            druh,
            celyDen,
            od,
            do: celyDen ? doDen : od,
            ...(celyDen ? {} : { casOd, casDo }),
            poznamka: poznamka.trim() || undefined,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložit se nepodařilo.');
        setBezi(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setChyba('Uložit se nepodařilo.');
      setBezi(false);
    }
  }

  async function smaz() {
    if (!upravovana) return;
    const res = await fetch(`/api/kalendar/nepritomnost?id=${upravovana.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setChyba(data?.error || 'Smazat se nepodařilo.');
      return;
    }
    onClose();
    router.refresh();
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div
      className="bg-surface rounded-card border-2 shadow-sm p-5 flex flex-col gap-4"
      style={{ borderColor: BARVA_NEPRITOMNOSTI }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {upravovana ? 'Úprava nepřítomnosti' : 'Dovolená / mimo studio'}
        </h2>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>

      {/* Druh - tři tlačítka místo rozbalovátka, jsou jen tři. */}
      <div className="flex items-center gap-2 flex-wrap">
        {DRUHY_NEPRITOMNOSTI.map((d) => (
          <button
            key={d.druh}
            type="button"
            onClick={() => setDruh(d.druh)}
            aria-pressed={druh === d.druh}
            className={`px-3.5 py-1.5 rounded-pill text-sm font-heading font-semibold border transition-colors ${
              druh === d.druh ? 'border-transparent text-ink' : 'border-line text-muted hover:text-ink'
            }`}
            style={druh === d.druh ? { backgroundColor: `${BARVA_NEPRITOMNOSTI}40` } : undefined}
          >
            {d.popisek}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Kdo</span>
        {spravce ? (
          <VyberProjektu
            projekty={lidiTymu}
            hodnota={kdo}
            onZmena={(v) => setKdo(v || ja.id)}
            placeholder="Začněte psát jméno…"
            prazdnyText="Takového člověka v týmu nemáme."
            popisZruseni="Zpátky na mě"
          />
        ) : (
          <span className="text-sm font-heading font-semibold text-ink">{upravovana?.jmeno ?? ja.label}</span>
        )}
      </label>

      <label className="inline-flex items-center gap-2.5 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={celyDen}
          onChange={(e) => setCelyDen(e.target.checked)}
          className="w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-body text-ink">Celý den</span>
      </label>

      {celyDen ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Od</span>
            <DatumPole
              value={od}
              onChange={(e) => {
                setOd(e.target.value);
                // Posune se i konec, kdyz by jinak skoncil pred zacatkem.
                if (e.target.value && doDen < e.target.value) setDoDen(e.target.value);
              }}
              className={`${inputClass} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Do (včetně)</span>
            <DatumPole value={doDen} onChange={(e) => setDoDen(e.target.value)} className={`${inputClass} tabular-nums`} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Den</span>
            <DatumPole value={od} onChange={(e) => setOd(e.target.value)} className={`${inputClass} tabular-nums`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Od</span>
            <input
              type="time"
              step={1800}
              value={casOd}
              onChange={(e) => setCasOd(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Do</span>
            <input
              type="time"
              step={1800}
              value={casDo}
              onChange={(e) => setCasDo(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </label>
        </div>
      )}
      {spatnyRozsah && (
        <span className="text-xs font-body text-danger -mt-2">
          {celyDen ? 'Poslední den nesmí být před prvním.' : 'Konec musí být po začátku.'}
        </span>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Poznámka</span>
        <input
          value={poznamka}
          onChange={(e) => setPoznamka(e.target.value)}
          placeholder="Nepovinné — třeba „na telefonu dostupný“"
          maxLength={500}
          className={inputClass}
        />
      </label>

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={bezi || spatnyRozsah}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {bezi ? 'Ukládám…' : upravovana ? 'Uložit změny' : 'Zapsat'}
        </button>
        <button type="button" onClick={onClose} className="text-muted text-sm font-heading">
          Zrušit
        </button>
        {upravovana && (
          <span className="ml-auto">
            <TlacitkoSmazat onSmazat={smaz} />
          </span>
        )}
      </div>
    </div>
  );
}
