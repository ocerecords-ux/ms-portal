'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  koruny,
  nazevMesicePalubovky,
  palivomer,
  prumerPoslednich,
  tachometr,
  zmenaProcent,
} from '@/lib/palubovka';
import type { Cile, PalubovkaData } from '@/lib/palubovkaServer';
import { Budik } from './Budik';
import { PrubehMesicu } from './PrubehMesicu';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum } from '@/lib/jazyk';

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
  vZalozce = false,
}: {
  data: PalubovkaData;
  cile: Cile;
  dnesISO: string;
  /**
   * Uvnitř Přehledů (zadání 27. 9. 2026: „dej mi to do přehledu na novou
   * kartu"). Sekce už má svůj nadpis i záložku, takže se druhý nadpis
   * „Palubovka" vypustí - jinak by nad budíky stály tři řádky titulků.
   */
  vZalozce?: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
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

  const tach = tachometr(tentoMesic.vyfakturovano, mesicniCil, dnes.getDate(), dnuVMesici, jazyk);
  const mesicuVPalivu = mesicniCil && mesicniCil > 0 ? data.palivoCelkem / mesicniCil : 0;
  const paliv = palivomer(mesicuVPalivu, cile.mesicuKryti, jazyk);

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
      if (!res.ok) throw new Error(telo.error || t('palubovka.cileNeulozeny'));
      setCile(telo.cile as Cile);
      setOtevreno(false);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('palubovka.cileNeulozeny'));
    } finally {
      setUklada(false);
    }
  }

  const rocniPomer = cile.rocniObrat ? data.odZacatkuRoku / cile.rocniObrat : null;
  const rocniOcekavano = (dnes.getMonth() + dnes.getDate() / dnuVMesici) / 12;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3 flex-wrap">
        {!vZalozce && <h1 className="font-display text-3xl text-ink m-0">{t('palubovka.nadpis')}</h1>}
        <span className="text-sm font-body text-muted">
          {t('palubovka.mesicRokVidisJenTy', {
            mesic: nazevMesicePalubovky(dnes.getMonth(), jazyk),
            rok: dnes.getFullYear(),
          })}
        </span>
        <button
          type="button"
          onClick={() => setOtevreno((o) => !o)}
          className="ml-auto rounded-pill border border-line text-muted font-heading font-semibold text-sm px-4 py-1.5 bg-surface hover:text-brand-purple hover:border-brand-purple transition-colors cursor-pointer"
        >
          {t(otevreno ? 'palubovka.zavrit' : 'palubovka.cile')}
        </button>
      </div>

      {otevreno && (
        <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4">
          <p className="text-sm font-body text-muted m-0 max-w-[70ch]">{t('palubovka.cileUvod')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-heading text-muted">{t('palubovka.mesicniObrat')}</span>
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
              <span className="text-xs font-heading text-muted">{t('palubovka.rocniObrat')}</span>
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
              <span className="text-xs font-heading text-muted">{t('palubovka.mesicuKryti')}</span>
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
            {t(uklada ? 'palubovka.ukladam' : 'palubovka.ulozitCile')}
          </button>
        </section>
      )}

      {/* JEDNO ČÍSLO, KTERÝM STRÁNKA ZAČÍNÁ. */}
      <section className="rounded-card border border-line bg-surface p-5 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {t('palubovka.vyfakturovanoV', { mesic: nazevMesicePalubovky(dnes.getMonth(), jazyk) })}
          </span>
          <span className="font-heading font-semibold text-[44px] leading-none text-ink">
            {koruny(tentoMesic.vyfakturovano, jazyk)}
          </span>
          <span className="text-xs font-body text-muted mt-1">
            {t('palubovka.ztohoUhrazeno', { castka: koruny(tentoMesic.uhrazeno, jazyk) })}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {zmenaLoni !== null && (
            <span className="text-sm font-body text-muted">
              <strong className={`font-heading ${zmenaLoni >= 0 ? 'text-status-done' : 'text-danger'}`}>
                {zmenaLoni > 0 ? '+' : ''}
                {zmenaLoni} %
              </strong>{' '}
              {t('palubovka.protiLoni')}
            </span>
          )}
          {zmenaPrumer !== null && (
            <span className="text-sm font-body text-muted">
              <strong className={`font-heading ${zmenaPrumer >= 0 ? 'text-status-done' : 'text-danger'}`}>
                {zmenaPrumer > 0 ? '+' : ''}
                {zmenaPrumer} %
              </strong>{' '}
              {t('palubovka.protiPrumeru')}
            </span>
          )}
        </div>
        <div className="flex flex-col ml-auto text-right">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {t('palubovka.odLedna')}
          </span>
          <span className="font-heading font-semibold text-xl text-ink">
            {koruny(data.odZacatkuRoku, jazyk)}
          </span>
          {rocniPomer !== null && (
            <span className="text-xs font-body text-muted">
              {t('palubovka.rocniCil', {
                procenta: Math.round(rocniPomer * 100),
                uteklo: Math.round(rocniOcekavano * 100),
              })}
            </span>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Budik
          nadpis={t('palubovka.tachometr')}
          hodnota={mesicniCil ? `${Math.round((tentoMesic.vyfakturovano / mesicniCil) * 100)} %` : '—'}
          budik={tach}
          znacka={1}
          spodniPopisek={
            mesicniCil
              ? t(cile.mesicniObrat ? 'palubovka.cilKc' : 'palubovka.cilKcPrumer', {
                  castka: koruny(mesicniCil, jazyk),
                })
              : t('palubovka.zadejCil')
          }
        />
        <Budik
          nadpis={t('palubovka.palivo')}
          hodnota={koruny(data.palivoCelkem, jazyk)}
          budik={paliv}
          znacka={cile.mesicuKryti / (cile.mesicuKryti * 2)}
          spodniPopisek={t('palubovka.rozjednanychProjektu', { pocet: data.projektuVPalivu })}
        />
      </div>

      <PrubehMesicu rady={data.rady} cil={mesicniCil} />

      <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading font-semibold text-sm text-ink m-0">
            {t('palubovka.zCehoFakturovat')}
          </h2>
          <span className="text-xs font-body text-muted">{t('palubovka.neukonceneProjekty')}</span>
        </div>
        {data.projektyVPalivu.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">{t('palubovka.nicRozjednaneho')}</p>
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
                  {p.termin ? formatDatum(jazyk, new Date(p.termin)) : t('palubovka.bezTerminu')}
                </span>
                <span className="font-heading font-semibold text-sm text-ink tabular-nums whitespace-nowrap">
                  {koruny(p.zbyva, jazyk)}
                  {p.odhad && (
                    <span className="text-muted font-body text-[11px]">{t('palubovka.odhad')}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] font-body text-muted m-0">{t('palubovka.poznamkaPaliva')}</p>
      </section>
    </div>
  );
}
