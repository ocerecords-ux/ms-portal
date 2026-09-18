'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  POPISKY_DRUHU,
  filtrujDruh,
  omezObdobi,
  poMesicich,
  souhrnBacklogu,
  znamenkoDni,
  type DruhBacklogu,
  type ZaznamBacklogu,
} from '@/lib/backlog';

/**
 * BACKLOG - PŘEHLED ODEVZDÁVÁNÍ V TERMÍNU (zadání 18. 9. 2026).
 *
 * Dvě barvy na celé obrazovce a obě mají jméno: zelená „v termínu", cihlová
 * „po termínu". Nejsou to zelená a červená schválně - ta dvojice je pro
 * barvosleposti skoro k nerozeznání (ověřeno měřením odstupu, ne od oka), a
 * tenhle přehled stojí a padá s tím, že se ty dva sloupce od sebe poznají.
 * Kromě barvy nese rozdíl i legenda, popisky u sloupců a tabulka dole.
 *
 * Grafy jsou obyčejné HTML bloky, ne obrázek - škálují se samy podle šířky
 * okna a na telefonu se nemusí nic posouvat do stran.
 */

const BARVA_V_TERMINU = 'bg-[#149E4B] dark:bg-[#2BAE66]';
const BARVA_PO_TERMINU = 'bg-[#C2410C] dark:bg-[#DB6A2E]';

const OBDOBI: { klic: number | null; popisek: string }[] = [
  { klic: 6, popisek: '6 měsíců' },
  { klic: 12, popisek: '12 měsíců' },
  { klic: null, popisek: 'Vše' },
];

export function BacklogKlient({ zaznamy }: { zaznamy: ZaznamBacklogu[] }) {
  const [druh, setDruh] = useState<DruhBacklogu>('VSE');
  const [mesicu, setMesicu] = useState<number | null>(12);
  const [vsechnyRadky, setVsechnyRadky] = useState(false);

  const vybrane = useMemo(
    () => omezObdobi(filtrujDruh(zaznamy, druh), mesicu),
    [zaznamy, druh, mesicu],
  );
  const souhrn = useMemo(() => souhrnBacklogu(vybrane), [vybrane]);
  const mesice = useMemo(() => poMesicich(vybrane), [vybrane]);

  const nejhorsi = useMemo(
    () => [...vybrane].sort((a, b) => a.skluz - b.skluz),
    [vybrane],
  );
  const radky = vsechnyRadky ? nejhorsi : nejhorsi.slice(0, 12);

  return (
    <div className="flex flex-col gap-5">
      {/* Filtry v jedné řadě nad grafy - druh projektu a období. */}
      <div className="flex items-center gap-2 flex-wrap">
        <Prepinac
          volby={(['VSE', 'AUDIOKNIHA', 'REKLAMA'] as DruhBacklogu[]).map((d) => ({
            klic: d,
            popisek: POPISKY_DRUHU[d],
          }))}
          vybrano={druh}
          onZmena={setDruh}
        />
        <span className="w-px h-6 bg-line" aria-hidden="true" />
        <Prepinac volby={OBDOBI} vybrano={mesicu} onZmena={setMesicu} />
      </div>

      {souhrn.pocet === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          Za tohle období tu zatím nic není. Backlog počítá z historie projektu — zná jen projekty,
          které se do stavu „Dokončeno - ke schválení" dostaly po 10. 9. 2026, a jen ty, které mají
          vyplněné datum dokončení.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Dlazdice popisek="Odevzdaných projektů" hodnota={String(souhrn.pocet)} />
            <Dlazdice
              popisek="V termínu"
              hodnota={`${souhrn.procentVTerminu} %`}
              pod={`${souhrn.vTerminu} z ${souhrn.pocet}`}
            />
            <Dlazdice
              popisek="Celkem dní"
              hodnota={znamenkoDni(souhrn.celkem)}
              pod={`${souhrn.dniPredem} dní k dobru · ${souhrn.dniPoTerminu} dní skluzu`}
            />
            <Dlazdice
              popisek="Průměr na projekt"
              hodnota={znamenkoDni(Math.round(souhrn.prumer))}
              pod={
                souhrn.nejdelsiSkluz > 0
                  ? `nejdelší skluz ${souhrn.nejdelsiSkluz} dní`
                  : 'žádný skluz'
              }
            />
          </div>

          <PodilVTerminu
            vTerminu={souhrn.vTerminu}
            poTerminu={souhrn.poTerminu}
            procentVTerminu={souhrn.procentVTerminu}
            procentPoTerminu={souhrn.procentPoTerminu}
          />

          <GrafMesicu mesice={mesice} />

          <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Projekty od největšího skluzu
              </h2>
              {nejhorsi.length > 12 && (
                <button
                  type="button"
                  onClick={() => setVsechnyRadky((v) => !v)}
                  className="text-xs font-heading font-semibold text-brand-purple"
                >
                  {vsechnyRadky ? 'Zkrátit' : `Zobrazit všech ${nejhorsi.length}`}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    <Th>Projekt</Th>
                    <Th>Termín</Th>
                    <Th>Odevzdáno</Th>
                    <Th trida="text-right">Dní</Th>
                  </tr>
                </thead>
                <tbody>
                  {radky.map((z) => (
                    <tr key={z.caflouProjectId} className="border-t border-line">
                      <td className="px-4 py-2.5 text-sm font-heading text-ink">
                        <Link
                          href={`/projekty/${encodeURIComponent(z.caflouProjectId)}`}
                          className="no-underline text-ink hover:text-brand-purple"
                        >
                          {z.nazev}
                        </Link>
                        <span className="block text-xs font-body text-muted">
                          {z.reklama ? 'Reklama' : 'Audiokniha'}
                          {z.typ ? ` · ${z.typ}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                        {formatujDen(z.termin)}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                        {formatujDen(z.odevzdano)}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className={`w-2.5 h-2.5 rounded-sm ${
                              z.skluz >= 0 ? BARVA_V_TERMINU : BARVA_PO_TERMINU
                            }`}
                          />
                          <span className="text-sm font-heading font-semibold text-ink tabular-nums">
                            {znamenkoDni(z.skluz)}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Vodorovný pruh s podílem - „procentuální přehled" ze zadání. */
function PodilVTerminu({
  vTerminu,
  poTerminu,
  procentVTerminu,
  procentPoTerminu,
}: {
  vTerminu: number;
  poTerminu: number;
  procentVTerminu: number;
  procentPoTerminu: number;
}) {
  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Podíl odevzdání
        </h2>
        <Legenda />
      </div>
      <div className="flex h-7 w-full rounded-pill overflow-hidden bg-field" role="img"
        aria-label={`V termínu ${procentVTerminu} procent, po termínu ${procentPoTerminu} procent`}>
        {vTerminu > 0 && (
          <div
            className={`${BARVA_V_TERMINU} flex items-center justify-center`}
            style={{ width: `${procentVTerminu}%` }}
          >
            {procentVTerminu >= 12 && (
              <span className="text-[11px] font-heading font-bold text-white">
                {procentVTerminu} %
              </span>
            )}
          </div>
        )}
        {/* Dvoupixelová mezera mezi plochami, ať se barvy nedotýkají. */}
        {vTerminu > 0 && poTerminu > 0 && <span className="w-0.5 bg-surface" aria-hidden="true" />}
        {poTerminu > 0 && (
          <div
            className={`${BARVA_PO_TERMINU} flex items-center justify-center`}
            style={{ width: `${procentPoTerminu}%` }}
          >
            {procentPoTerminu >= 12 && (
              <span className="text-[11px] font-heading font-bold text-white">
                {procentPoTerminu} %
              </span>
            )}
          </div>
        )}
      </div>
      <p className="text-xs font-body text-muted m-0">
        {vTerminu} v termínu · {poTerminu} po termínu
      </p>
    </div>
  );
}

/**
 * Sloupce po měsících. Nad osou dny k dobru, pod osou skluz - jedna osa,
 * jedno měřítko, takže se sloupce dají porovnávat mezi sebou.
 */
function GrafMesicu({
  mesice,
}: {
  mesice: { klic: string; popisek: string; vTerminu: number; poTerminu: number; dni: number }[];
}) {
  const [najeto, setNajeto] = useState<string | null>(null);
  if (mesice.length === 0) return null;

  const nejvic = Math.max(1, ...mesice.map((m) => Math.abs(m.dni)));
  const detail = mesice.find((m) => m.klic === najeto) ?? null;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Dny podle měsíce odevzdání
        </h2>
        <Legenda />
      </div>

      <div className="relative">
        {detail && (
          <div className="absolute right-0 -top-1 z-10 rounded-lg border border-line bg-surface shadow-lg px-3 py-2 text-xs font-body text-ink">
            <strong className="font-heading">{detail.popisek}</strong>
            <span className="block text-muted">
              {detail.vTerminu} v termínu · {detail.poTerminu} po termínu
            </span>
            <span className="block text-muted">Celkem {znamenkoDni(detail.dni)} dní</span>
          </div>
        )}

        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {mesice.map((m) => {
            const vyska = `${Math.round((Math.abs(m.dni) / nejvic) * 100)}%`;
            const kladne = m.dni > 0;
            return (
              <div
                key={m.klic}
                onMouseEnter={() => setNajeto(m.klic)}
                onMouseLeave={() => setNajeto((k) => (k === m.klic ? null : k))}
                onFocus={() => setNajeto(m.klic)}
                onBlur={() => setNajeto((k) => (k === m.klic ? null : k))}
                tabIndex={0}
                title={`${m.popisek}: ${znamenkoDni(m.dni)} dní, ${m.vTerminu} v termínu, ${m.poTerminu} po termínu`}
                className={`flex-1 min-w-[26px] flex flex-col items-center rounded-lg outline-none ${
                  najeto === m.klic ? 'bg-field/70' : ''
                }`}
              >
                <span className="h-[72px] w-full flex items-end justify-center">
                  {kladne && (
                    <span
                      className={`w-3 rounded-t ${BARVA_V_TERMINU}`}
                      style={{ height: vyska, minHeight: 3 }}
                    />
                  )}
                </span>
                <span className="h-px w-full bg-line" aria-hidden="true" />
                <span className="h-[72px] w-full flex items-start justify-center">
                  {m.dni < 0 && (
                    <span
                      className={`w-3 rounded-b ${BARVA_PO_TERMINU}`}
                      style={{ height: vyska, minHeight: 3 }}
                    />
                  )}
                </span>
                <span className="mt-1 text-[10px] font-heading text-muted tabular-nums">
                  {m.popisek}
                </span>
                <span className="text-[10px] font-heading font-bold text-ink tabular-nums">
                  {m.dni === 0 && m.vTerminu + m.poTerminu === 0 ? '—' : znamenkoDni(m.dni)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legenda() {
  return (
    <span className="flex items-center gap-3 text-xs font-body text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-sm ${BARVA_V_TERMINU}`} aria-hidden="true" />
        v termínu
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-sm ${BARVA_PO_TERMINU}`} aria-hidden="true" />
        po termínu
      </span>
    </span>
  );
}

function Dlazdice({ popisek, hodnota, pod }: { popisek: string; hodnota: string; pod?: string }) {
  return (
    <div className="bg-surface rounded-card border border-line shadow-sm px-4 py-3">
      <span className="block font-heading font-semibold text-[11px] uppercase tracking-[0.12em] text-muted">
        {popisek}
      </span>
      <span className="block font-display text-2xl text-ink tabular-nums mt-0.5">{hodnota}</span>
      {pod && <span className="block text-xs font-body text-muted mt-0.5">{pod}</span>}
    </div>
  );
}

function Prepinac<T extends string | number | null>({
  volby,
  vybrano,
  onZmena,
}: {
  volby: { klic: T; popisek: string }[];
  vybrano: T;
  onZmena: (klic: T) => void;
}) {
  return (
    <span className="inline-flex rounded-pill border border-line overflow-hidden">
      {volby.map((v) => (
        <button
          key={String(v.klic)}
          type="button"
          onClick={() => onZmena(v.klic)}
          aria-pressed={v.klic === vybrano}
          className={`px-3 py-1.5 text-xs font-heading font-semibold transition-colors ${
            v.klic === vybrano
              ? 'bg-brand-purple text-white'
              : 'bg-surface text-muted hover:text-brand-purple'
          }`}
        >
          {v.popisek}
        </button>
      ))}
    </span>
  );
}

function Th({ children, trida = '' }: { children: React.ReactNode; trida?: string }) {
  return (
    <th
      className={`px-4 py-2.5 font-heading font-semibold text-[11px] uppercase tracking-[0.12em] text-muted ${trida}`}
    >
      {children}
    </th>
  );
}

function formatujDen(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('cs-CZ').format(d);
}
