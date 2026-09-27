'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MESICE,
  koruny,
  palivomer,
  popisMesicu,
  prumerPoslednich,
  tachometr,
  zmenaProcent,
} from '@/lib/palubovka';
import type { Cile, PalubovkaData } from '@/lib/palubovkaServer';
import { Budik } from './Budik';
import { PrubehMesicu } from './PrubehMesicu';

/**
 * PALUBOVKA (zadání 27. 9. 2026). Dva budíky, průběh měsíců a co tvoří palivo.
 *
 * Nahoře stojí JEDNO číslo - kolik jsme tenhle měsíc vyfakturovali. Všechno
 * ostatní je kontext k němu: budíky říkají, jestli to stačí, graf ukazuje,
 * jestli to roste, a tabulka, z čeho se bude fakturovat dál.
 */

const pole =
  'rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple w-full';

export function Palubovka({
  data,
  cile: cilePocatecni,
  dnesISO,
}: {
  data: PalubovkaData;
  cile: Cile;
  dnesISO: string;
}) {
  const [cile, setCile] = useState(cilePocatecni);
  const [otevreno, setOtevreno] = useState(false);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const dnes = useMemo(() => new Date(dnesISO), [dnesISO]);
  const tentoMesic = data.rady[data.rady.length - 1];
  const dnuVMesici = new Date(dnes.getFullYear(), dnes.getMonth() + 1, 0).getDate();

  const prumer3 = prumerPoslednich(data.rady, 3);
  // Bez zadaného cíle se měří proti tomu, co firma běžně dělá - budík nemá
  // zůstat prázdný jen proto, že někdo nevyplnil číslo.
  const mesicniCil = cile.mesicniObrat ?? (prumer3 ? Math.round(prumer3) : null);

  const tach = tachometr(tentoMesic.vyfakturovano, mesicniCil, dnes.getDate(), dnuVMesici);
  const mesicuVPalivu = mesicniCil && mesicniCil > 0 ? data.palivoCelkem / mesicniCil : 0;
  const paliv = palivomer(mesicuVPalivu, cile.mesicuKryti);

  /**
   * SROVNÁNÍ S LOŇSKEM JEN TEHDY, KDYŽ JE S ČÍM. Faktury jsou v portálu teprve
   * od jara 2026 (jednorázový přenos z Caflou), takže loňský měsíc bývá
   * pahýl - a „+2463 %" pak není informace, ale šum. Bereme ho, až když
   * vypadá jako skutečný měsíc: aspoň čtvrtina dnešního průměru.
   */
  const loniJeDuveryhodne =
    data.stejnyMesicLoni !== null && prumer3 !== null && data.stejnyMesicLoni >= prumer3 * 0.25;
  const zmenaLoni = loniJeDuveryhodne
    ? zmenaProcent(tentoMesic.vyfakturovano, data.stejnyMesicLoni)
    : null;
  const zmenaPrumer = zmenaProcent(tentoMesic.vyfakturovano, prumer3);

  async function uloz(nove: Cile) {
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch('/api/palubovka/cile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nove),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || 'Cíle se nepodařilo uložit.');
      setCile(telo.cile as Cile);
      setOtevreno(false);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Cíle se nepodařilo uložit.');
    } finally {
      setUklada(false);
    }
  }

  const rocniPomer = cile.rocniObrat ? data.odZacatkuRoku / cile.rocniObrat : null;
  const rocniOcekavano = (dnes.getMonth() + dnes.getDate() / dnuVMesici) / 12;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="font-display text-3xl text-ink m-0">Palubovka</h1>
        <span className="text-sm font-body text-muted">
          {MESICE[dnes.getMonth()]} {dnes.getFullYear()} · vidíš jen ty
        </span>
        <button
          type="button"
          onClick={() => setOtevreno((o) => !o)}
          className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer"
        >
          {otevreno ? 'Zavřít' : 'Cíle'}
        </button>
      </div>

      {otevreno && (
        <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4">
          <p className="text-sm font-body text-muted m-0 max-w-[70ch]">
            Proti těmhle číslům se budíky měří. Když měsíční cíl necháš prázdný, bere se průměr
            posledních tří měsíců — tedy „jedeme jako obvykle".
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-heading text-muted">Měsíční obrat (Kč bez DPH)</span>
              <input
                type="number"
                min={0}
                step={10000}
                value={cile.mesicniObrat ?? ''}
                onChange={(e) =>
                  setCile({ ...cile, mesicniObrat: e.target.value ? Number(e.target.value) : null })
                }
                className={pole}
                placeholder={prumer3 ? String(Math.round(prumer3)) : ''}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-heading text-muted">Roční obrat (Kč bez DPH)</span>
              <input
                type="number"
                min={0}
                step={100000}
                value={cile.rocniObrat ?? ''}
                onChange={(e) =>
                  setCile({ ...cile, rocniObrat: e.target.value ? Number(e.target.value) : null })
                }
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-heading text-muted">Chci mít rozjednáno na (měsíců)</span>
              <input
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={cile.mesicuKryti}
                onChange={(e) => setCile({ ...cile, mesicuKryti: Number(e.target.value) || 2 })}
                className={pole}
              />
            </label>
          </div>
          {chyba && (
            <p className="text-sm font-body text-danger m-0" role="alert">
              {chyba}
            </p>
          )}
          <button
            type="button"
            onClick={() => void uloz(cile)}
            disabled={uklada}
            className="self-start rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 hover:bg-brand-purpleDeep transition-colors cursor-pointer disabled:opacity-50"
          >
            {uklada ? 'Ukládám…' : 'Uložit cíle'}
          </button>
        </section>
      )}

      {/* JEDNO ČÍSLO, KTERÝM STRÁNKA ZAČÍNÁ. */}
      <section className="rounded-card border border-line bg-surface p-5 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            Vyfakturováno v {MESICE[dnes.getMonth()]}u
          </span>
          <span className="font-heading font-semibold text-[44px] leading-none text-ink">
            {koruny(tentoMesic.vyfakturovano)}
          </span>
          <span className="text-xs font-body text-muted mt-1">
            z toho uhrazeno {koruny(tentoMesic.uhrazeno)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {zmenaLoni !== null && (
            <span className="text-sm font-body text-muted">
              <strong className={`font-heading ${zmenaLoni >= 0 ? 'text-status-done' : 'text-danger'}`}>
                {zmenaLoni > 0 ? '+' : ''}
                {zmenaLoni} %
              </strong>{' '}
              proti stejnému měsíci loni
            </span>
          )}
          {zmenaPrumer !== null && (
            <span className="text-sm font-body text-muted">
              <strong className={`font-heading ${zmenaPrumer >= 0 ? 'text-status-done' : 'text-danger'}`}>
                {zmenaPrumer > 0 ? '+' : ''}
                {zmenaPrumer} %
              </strong>{' '}
              proti průměru tří měsíců
            </span>
          )}
        </div>
        <div className="flex flex-col ml-auto text-right">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            Od ledna
          </span>
          <span className="font-heading font-semibold text-xl text-ink">{koruny(data.odZacatkuRoku)}</span>
          {rocniPomer !== null && (
            <span className="text-xs font-body text-muted">
              {Math.round(rocniPomer * 100)} % ročního cíle, roku uteklo{' '}
              {Math.round(rocniOcekavano * 100)} %
            </span>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Budik
          nadpis="Tachometr — tenhle měsíc"
          hodnota={mesicniCil ? `${Math.round((tentoMesic.vyfakturovano / mesicniCil) * 100)} %` : '—'}
          budik={tach}
          znacka={1}
          spodniPopisek={
            mesicniCil
              ? `Cíl ${koruny(mesicniCil)}${cile.mesicniObrat ? '' : ' (průměr tří měsíců)'}`
              : 'Zadej si měsíční cíl v Cílech'
          }
        />
        <Budik
          nadpis="Palivo — co máme rozjednáno"
          hodnota={koruny(data.palivoCelkem)}
          budik={paliv}
          znacka={cile.mesicuKryti / (cile.mesicuKryti * 2)}
          spodniPopisek={`${data.projektuVPalivu} rozjednaných projektů`}
        />
      </div>

      <PrubehMesicu rady={data.rady} cil={mesicniCil} />

      <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading font-semibold text-sm text-ink m-0">Z čeho se bude fakturovat</h2>
          <span className="text-xs font-body text-muted">
            neukončené projekty, kde ještě není vyfakturováno všechno
          </span>
        </div>
        {data.projektyVPalivu.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">
            Nic rozjednaného — to je ta chvíle, kdy se má přidat na obchodu.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col">
            {data.projektyVPalivu.map((p) => (
              <li
                key={p.caflouProjectId}
                className="flex items-baseline gap-3 py-2 border-b border-line last:border-0"
              >
                <Link
                  href={`/projekty/${encodeURIComponent(p.caflouProjectId)}`}
                  className="font-heading font-semibold text-sm text-ink no-underline hover:text-brand-purple truncate"
                >
                  {p.nazev}
                </Link>
                <span className="text-xs font-body text-muted truncate">{p.firma}</span>
                <span className="ml-auto text-xs font-body text-muted whitespace-nowrap">
                  {p.termin ? new Date(p.termin).toLocaleDateString('cs-CZ') : 'bez termínu'}
                </span>
                <span className="font-heading font-semibold text-sm text-ink tabular-nums whitespace-nowrap">
                  {koruny(p.zbyva)}
                  {p.odhad && <span className="text-muted font-body text-[11px]"> odhad</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] font-body text-muted m-0">
          Počítá se schválená nebo odeslaná nabídka mínus to, co už je z projektu vyfakturované.
          Kde nabídka není, bere se u audioknihy odhad z normostran a sazby klienta.
        </p>
      </section>
    </div>
  );
}
