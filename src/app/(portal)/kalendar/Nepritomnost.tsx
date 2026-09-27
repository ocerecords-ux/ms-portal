'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DruhNepritomnosti } from '@prisma/client';
import {
  BARVA_NEPRITOMNOSTI,
  PASMO_NEPRITOMNOSTI,
  denVPraze,
  posledniDen,
  rozsahSlovy,
  type NepritomnostVKalendari,
} from '@/lib/nepritomnost';
import { DatumPole } from '@/components/DatumPole';
import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { VyberProjektu } from '@/app/(portal)/components/VyberProjektu';
import { kodJazyka } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * KALENDÁŘ MIMO STUDIO - kousky, které se kreslí do kalendáře studií (zadání
 * 19. 9. 2026, viz lib/nepritomnost.ts).
 *
 * Chová se jako každý jiný kalendář: událost na pár hodin je v hodinové
 * mřížce na svém místě, CELODENNÍ má vlastní pruh nad hodinami - v mřížce by
 * zabrala sloupec od půlnoci do půlnoci a přikryla natáčení. Stejně to dělá
 * každý běžný kalendář.
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
  const t = usePreklad();
  const jazyk = useJazyk();
  // Jméno i poznámka jsou data uživatele - do věty vstupují, nepřekládají se.
  const popis = `${t('nepritomnost.cipPopis', { jmeno: n.jmeno, rozsah: rozsahSlovy(n) })}${
    n.poznamka ? ` · ${n.poznamka}` : ''
  }`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (n.muzeUpravit) onOtevri(n);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={n.muzeUpravit ? `${popis}\n${t('nepritomnost.klepnutimUpravite')}` : popis}
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
          {new Intl.DateTimeFormat(kodJazyka(jazyk), {
            timeZone: PASMO_NEPRITOMNOSTI,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(new Date(n.start))}{' '}
        </span>
      )}
      {n.jmeno}
      {n.poznamka && <span className="text-muted"> · {n.poznamka}</span>}
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
  const t = usePreklad();
  return (
    <div
      className="grid border-b border-line bg-paper/40"
      style={{ gridTemplateColumns: `52px repeat(${dny.length}, 1fr)` }}
    >
      <div
        className="px-1 py-1.5 text-[9px] font-heading text-muted uppercase tracking-wide text-right leading-tight self-center"
        title={t('nepritomnost.pruhBublina')}
      >
        {t('nepritomnost.mimoStudio')}
      </div>
      {dny.map((den) => {
        const vDni = podleDnu.get(den.key) ?? [];
        return (
          <div
            key={den.key}
            className="border-l border-line p-1 flex flex-col gap-0.5 min-h-[28px]"
            onDoubleClick={() => onNova(den.key)}
            title={vDni.length === 0 ? t('nepritomnost.dvojklikCelyDen') : undefined}
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
  vsechny: NepritomnostVKalendari[],
  /** Jen celodenní - do pruhu nad mřížkou. Ty na pár hodin jsou v mřížce. */
  jenCelodenni = false,
): Map<string, NepritomnostVKalendari[]> {
  const nepritomnosti = jenCelodenni ? vsechny.filter((n) => n.celyDen) : vsechny;
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

/** Den „YYYY-MM-DD" posunutý o `n` dní. Počítá se v UTC, ať ho nerozhodí změna času. */
function posunDen(den: string, n: number): string {
  const d = new Date(`${den}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Kolik dní je od `od` do `doo` včetně obou. */
function pocetDni(od: string, doo: string): number {
  const rozdil = new Date(`${doo}T12:00:00.000Z`).getTime() - new Date(`${od}T12:00:00.000Z`).getTime();
  return Math.round(rozdil / 86_400_000) + 1;
}

/** Nejvíc dní, které jde zapsat jedním zadáním. */
const NEJVIC_DNI = 366;

/**
 * HH:MM do políčka `<input type="time">`. Není to text pro čtení, ale hodnota
 * pro prohlížeč, takže se nepřekládá - formát musí zůstat 24hodinový.
 */
function minutyNaCas(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PASMO_NEPRITOMNOSTI,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/**
 * Okno pro zápis a úpravu v kalendáři Mimo studio. JEN OSOBA A ČAS (upřesnění
 * 19. 9. 2026: „v tom kalendáři Mimo studio chci jen vybrat osobu. Ta bude
 * předvyplněná podle přihlášeného uživatele, a čas a celodenní událost").
 *
 * Žádný projekt, studio, druh ani poznámka. Osobu si může přepnout každý -
 * třeba když zapisuje za kolegu, který o tom řekl na chodbě.
 */
export function NepritomnostForm({
  upravovana,
  vychoziDen,
  vychoziCelyDen = true,
  vychoziCasOd,
  vychoziCasDo,
  ja,
  lidiTymu,
  onClose,
  onPorada,
}: {
  upravovana: NepritomnostVKalendari | null;
  /** Přepnutí nového záznamu na poradu (21. 9. 2026). */
  onPorada?: (den: string, casOd: string, casDo: string) => void;
  /** YYYY-MM-DD - den, do kterého se dvojkliklo. */
  vychoziDen: string;
  /**
   * Dvojklik do hodinové mřížky zakládá událost na čas, do pruhu nebo do
   * měsíce na celý den - stejně jako v jiných kalendářích.
   */
  vychoziCelyDen?: boolean;
  /** HH:MM */
  vychoziCasOd?: string;
  vychoziCasDo?: string;
  ja: Osoba;
  /** Lidé z týmu, ze kterých se vybírá osoba. */
  lidiTymu: Osoba[];
  onClose: () => void;
}) {
  const t = usePreklad();
  const router = useRouter();
  // Prihlaseny v seznamu byt musi, i kdyby se nenacetl - jinak by ho nesel vybrat.
  const lide = lidiTymu.some((l) => l.id === ja.id) ? lidiTymu : [ja, ...lidiTymu];

  const [kdo, setKdo] = useState(upravovana?.userId ?? ja.id);
  // Druh se nevybira (upresneni 19. 9. 2026) - vsechno je „mimo studio".
  // U stareho zaznamu se puvodni druh jen zachova.
  const druh: DruhNepritomnosti = upravovana?.druh ?? 'MIMO_STUDIO';
  const [celyDen, setCelyDen] = useState(upravovana?.celyDen ?? vychoziCelyDen);
  const [od, setOd] = useState(upravovana ? denVPraze(new Date(upravovana.start)) : vychoziDen);
  const [doDen, setDoDen] = useState(
    upravovana ? (upravovana.celyDen ? posledniDen(upravovana.end) : denVPraze(new Date(upravovana.start))) : vychoziDen,
  );
  const [casOd, setCasOd] = useState(
    upravovana && !upravovana.celyDen ? minutyNaCas(new Date(upravovana.start)) : vychoziCasOd ?? '09:00',
  );
  const [casDo, setCasDo] = useState(
    upravovana && !upravovana.celyDen ? minutyNaCas(new Date(upravovana.end)) : vychoziCasDo ?? '13:00',
  );
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  /**
   * ROZSAH DAT JEDNÍM ZADÁNÍM (zadání 19. 9. 2026: „chybí rozsah data, abych
   * mohl nastavit jedním zadáním třeba celodenní mimo studio na zvolený počet
   * dnů"). Od–do a počet dní jsou propojené: změna jednoho dopočítá druhé.
   *
   * Na čas (ne celý den) jde rozsah taky - zapíše se tentýž čas do každého
   * dne zvlášť, třeba „každé odpoledne od pondělí do středy". U úpravy už
   * zapsaného záznamu na čas je to jeden den, protože je to jeden záznam.
   */
  const jedenDen = Boolean(upravovana && !upravovana.celyDen);
  const dni = pocetDni(od, doDen);
  const spatnyRozsah =
    !od || !doDen || doDen < od || dni > NEJVIC_DNI || (!celyDen && casDo <= casOd);

  function zmenOd(nove: string) {
    if (!nove) return;
    // Posune se i konec - pocet dni zustava.
    setDoDen(jedenDen ? nove : posunDen(nove, Math.max(0, dni - 1)));
    setOd(nove);
  }

  function zmenPocet(hodnota: string) {
    const n = Math.round(Number(hodnota));
    if (!Number.isFinite(n) || n < 1) return;
    setDoDen(posunDen(od, Math.min(n, NEJVIC_DNI) - 1));
  }

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
            userId: kdo,
            druh,
            celyDen,
            od,
            do: jedenDen ? od : doDen,
            ...(celyDen ? {} : { casOd, casDo }),
            // Poznamka se uz nepise; u stareho zaznamu se zachova.
            poznamka: upravovana?.poznamka || undefined,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('nepritomnost.chybaUlozeni'));
        setBezi(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setChyba(t('nepritomnost.chybaUlozeni'));
      setBezi(false);
    }
  }

  async function smaz() {
    if (!upravovana) return;
    const res = await fetch(`/api/kalendar/nepritomnost?id=${upravovana.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setChyba(data?.error || t('mazani.nezdarilo'));
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
          {upravovana ? t('nepritomnost.nadpisUprava') : t('nepritomnost.mimoStudio')}
        </h2>
        {onPorada && (
          <button
            type="button"
            onClick={() => onPorada(od, casOd, casDo)}
            className="ml-auto text-xs font-heading font-semibold text-brand-purple hover:underline"
          >
            {t('nepritomnost.mistoTohoPorada')}
          </button>
        )}
        <button type="button" onClick={onClose} aria-label={t('obecne.zavrit')} className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">{t('nepritomnost.osoba')}</span>
        <VyberProjektu
          projekty={lide}
          hodnota={kdo}
          onZmena={(v) => setKdo(v || ja.id)}
          placeholder={t('nepritomnost.zacnetePsatJmeno')}
          prazdnyText={t('nepritomnost.nikdoTakovy')}
          popisZruseni={t('nepritomnost.zpatkyNaMe')}
        />
      </label>

      <label className="inline-flex items-center gap-2.5 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={celyDen}
          onChange={(e) => setCelyDen(e.target.checked)}
          className="w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-body text-ink">{t('nepritomnost.celyDen')}</span>
      </label>

      <div className={`grid grid-cols-1 gap-3 ${jedenDen ? '' : 'sm:grid-cols-[1fr_1fr_110px]'}`}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{jedenDen ? t('nepritomnost.den') : t('nepritomnost.od')}</span>
          <DatumPole value={od} onChange={(e) => zmenOd(e.target.value)} className={`${inputClass} tabular-nums`} />
        </label>
        {!jedenDen && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('nepritomnost.doVcetne')}</span>
              <DatumPole
                value={doDen}
                onChange={(e) => e.target.value && setDoDen(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('nepritomnost.pocetDni')}</span>
              <input
                type="number"
                min={1}
                max={NEJVIC_DNI}
                value={dni >= 1 ? dni : ''}
                onChange={(e) => zmenPocet(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </label>
          </>
        )}
      </div>

      {!celyDen && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('nepritomnost.casOd')}</span>
            <input
              type="time"
              step={1800}
              value={casOd}
              onChange={(e) => setCasOd(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('nepritomnost.casDo')}</span>
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
      {!celyDen && !jedenDen && dni > 1 && !spatnyRozsah && (
        <span className="text-xs font-body text-muted -mt-2">
          {t('nepritomnost.zapiseSe', { pocet: dni, od: casOd, do: casDo })}
        </span>
      )}
      {spatnyRozsah && (
        <span className="text-xs font-body text-danger -mt-2">
          {doDen < od
            ? t('nepritomnost.chybaPoradiDnu')
            : dni > NEJVIC_DNI
              ? t('nepritomnost.chybaNejvicDni', { pocet: NEJVIC_DNI })
              : t('nepritomnost.chybaKonecPoZacatku')}
        </span>
      )}

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={bezi || spatnyRozsah}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {bezi ? t('obecne.ukladam') : upravovana ? t('nepritomnost.ulozitZmeny') : t('nepritomnost.zapsat')}
        </button>
        <button type="button" onClick={onClose} className="text-muted text-sm font-heading">
          {t('obecne.zrusit')}
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
