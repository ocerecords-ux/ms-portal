'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { HudbaSeznam, type HudbaApi, type SkladbaVSeznamu } from '@/app/(portal)/components/HudbaSeznam';
import type { ProjektBezHudby, RadekKnihovny } from '@/lib/hudbaKnihovnaServer';
import { delkaTextem } from '@/lib/metadataHudby';

/**
 * HUDBA K AUDIOKNIHÁM - TŘI ZÁLOŽKY (17. 10. 2026).
 *
 * Databáze: co všechno jsme kdy použili a kde to leží.
 * Série: hudba, kterou dědí každý další díl.
 * Chybí hudba: audioknihy, kde se blíží natáčení a hudba není.
 */
type Zalozka = 'databaze' | 'serie' | 'chybi';

export function HudbaAudioknih({
  knihovna,
  serie,
  chybi,
  firmy,
  dropboxNastaven,
}: {
  knihovna: RadekKnihovny[];
  serie: { serie: string; firma: string | null; skladeb: number }[];
  chybi: ProjektBezHudby[];
  firmy: { id: string; name: string }[];
  dropboxNastaven: boolean;
}) {
  const t = usePreklad();
  const [zalozka, setZalozka] = useState<Zalozka>('chybi');

  const zalozky: { klic: Zalozka; popis: string; pocet: number }[] = [
    { klic: 'chybi', popis: t('hudbaKnihovna.chybi'), pocet: chybi.length },
    { klic: 'serie', popis: t('hudbaKnihovna.serie'), pocet: serie.length },
    { klic: 'databaze', popis: t('hudbaKnihovna.databaze'), pocet: knihovna.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 flex-wrap">
        {zalozky.map((z) => (
          <button
            key={z.klic}
            type="button"
            onClick={() => setZalozka(z.klic)}
            className={`rounded-pill px-4 py-2 text-sm font-heading font-semibold cursor-pointer border transition-colors ${
              zalozka === z.klic
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'bg-surface text-muted border-line hover:text-ink'
            }`}
          >
            {z.popis}
            <span className="ml-2 opacity-70">{z.pocet}</span>
          </button>
        ))}
      </div>

      {zalozka === 'chybi' && <Chybi radky={chybi} />}
      {zalozka === 'serie' && (
        <Serie serie={serie} firmy={firmy} dropboxNastaven={dropboxNastaven} />
      )}
      {zalozka === 'databaze' && <Databaze radky={knihovna} />}
    </div>
  );
}

/* ----------------------------------------------------------- Chybí hudba */

function Chybi({ radky }: { radky: ProjektBezHudby[] }) {
  const t = usePreklad();
  if (radky.length === 0) {
    return <p className="text-sm font-body text-muted m-0">{t('hudbaKnihovna.chybiZadne')}</p>;
  }

  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-2">
      {radky.map((r) => (
        <li
          key={r.id}
          className="rounded-card border border-line bg-surface px-4 py-3 flex flex-wrap items-center gap-3"
        >
          <span className="flex-1 min-w-[200px]">
            <Link
              href={`/projekty/${r.id}`}
              className="block font-heading font-semibold text-sm text-ink no-underline hover:text-brand-purpleLight"
            >
              {r.nazev}
            </Link>
            <span className="block text-xs font-body text-muted">
              {[r.firma, r.serie].filter(Boolean).join(' · ') || '—'}
            </span>
          </span>

          <span className="text-xs font-body text-muted min-w-[150px]">
            {r.prvniFrekvence ? (
              <>
                {t('hudbaKnihovna.prvniFrekvence')}{' '}
                <b className={naleha(r.zaDni) ? 'text-status-error' : 'text-ink'}>
                  {datum(r.prvniFrekvence)}
                </b>
                {r.zaDni !== null && (
                  <span className="block">{popisDnu(r.zaDni, t)}</span>
                )}
              </>
            ) : (
              t('hudbaKnihovna.bezTerminu')
            )}
          </span>

          <span className="text-xs font-body min-w-[170px]">
            {r.hudbuDodavaKlient ? (
              <span className="text-brand-purpleLight">
                {t('hudbaKnihovna.dodavaKlient')}
                <span className="block text-muted">
                  {r.vyzva?.odeslanoAt
                    ? `${t('hudbaKnihovna.vyzvaOdeslana')} ${datum(r.vyzva.odeslanoAt)}`
                    : t('hudbaKnihovna.vyzvaCeka')}
                </span>
              </span>
            ) : (
              <span className="text-muted">{t('hudbaKnihovna.vybiramMy')}</span>
            )}
          </span>

          <Link
            href={`/projekty/${r.id}`}
            className="rounded-pill bg-brand-purple text-white px-4 py-1.5 text-xs font-heading font-semibold no-underline hover:bg-brand-purpleDark transition-colors"
          >
            {t('hudbaKnihovna.vlozitHudbu')}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function naleha(zaDni: number | null): boolean {
  return zaDni !== null && zaDni <= 3;
}

/* ----------------------------------------------------------------- Série */

function Serie({
  serie,
  firmy,
  dropboxNastaven,
}: {
  serie: { serie: string; firma: string | null; skladeb: number }[];
  firmy: { id: string; name: string }[];
  dropboxNastaven: boolean;
}) {
  const t = usePreklad();
  const [vybrana, setVybrana] = useState<string | null>(serie[0]?.serie ?? null);
  const [firmaId, setFirmaId] = useState<string>('');
  const [nova, setNova] = useState('');
  const [hudba, setHudba] = useState<SkladbaVSeznamu[] | null>(null);
  const [klic, setKlic] = useState(0);

  // Hudba série se dotahuje až po výběru - sérií můžou být desítky a tahat
  // skladby všech naráz by stránku zdrželo kvůli tomu, co nikdo neuvidí.
  useEffect(() => {
    let zahozeno = false;
    if (!vybrana) {
      setHudba([]);
      return;
    }
    setHudba(null);
    const adresa = `/api/hudba-serie?serie=${encodeURIComponent(vybrana)}${
      firmaId ? `&companyId=${encodeURIComponent(firmaId)}` : ''
    }`;
    fetch(adresa)
      .then((r) => (r.ok ? r.json() : { hudba: [] }))
      .then((d: { hudba: SkladbaVSeznamu[] }) => {
        if (!zahozeno) {
          setHudba(d.hudba);
          setKlic((k) => k + 1);
        }
      })
      .catch(() => {
        if (!zahozeno) setHudba([]);
      });
    return () => {
      zahozeno = true;
    };
  }, [vybrana, firmaId]);

  const api: HudbaApi = {
    podpis: '/api/hudba-serie/podpis',
    obalPodpis: '/api/hudba-serie/obal-podpis',
    zapis: '/api/hudba-serie',
    polozka: (id) => `/api/hudba-serie/${id}`,
    obal: (id) => `/api/hudba-serie/${id}/obal`,
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="lg:w-[260px] shrink-0 flex flex-col gap-2">
        <ul className="list-none p-0 m-0 flex flex-col gap-1">
          {serie.map((s) => (
            <li key={`${s.serie}|${s.firma ?? ''}`}>
              <button
                type="button"
                onClick={() => setVybrana(s.serie)}
                className={`w-full text-left rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  vybrana === s.serie
                    ? 'border-brand-purple bg-tint'
                    : 'border-line bg-surface hover:border-brand-purpleLight'
                }`}
              >
                <span className="block font-heading text-sm text-ink">{s.serie}</span>
                <span className="block text-[11px] font-body text-muted">
                  {[s.firma, `${s.skladeb}×`].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Nová série se tu nezakládá „naprázdno" - vznikne tím, že se do ní
            vloží první skladba. Prázdná série by v seznamu jen překážela. */}
        <div className="rounded-lg border border-line bg-surface p-3 flex flex-col gap-2">
          <span className="text-[11px] font-heading uppercase tracking-wide text-muted">
            {t('hudbaKnihovna.novaSerie')}
          </span>
          <input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder={t('hudbaKnihovna.nazevSerie')}
            className="rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
          />
          <select
            value={firmaId}
            onChange={(e) => setFirmaId(e.target.value)}
            className="rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
          >
            <option value="">{t('hudbaKnihovna.vsechnyFirmy')}</option>
            {firmy.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!nova.trim()}
            onClick={() => setVybrana(nova.trim())}
            className="rounded-pill border-0 bg-brand-purple px-3 py-1.5 text-xs font-heading font-semibold text-white cursor-pointer hover:bg-brand-purpleDark transition-colors disabled:opacity-50"
          >
            {t('hudbaKnihovna.otevrit')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {vybrana ? (
          <>
            <h2 className="font-heading text-lg text-ink m-0">{vybrana}</h2>
            <p className="text-sm font-body text-muted m-0">{t('hudbaKnihovna.serieUvod')}</p>
            {hudba === null ? (
              <p className="text-sm font-body text-muted m-0">{t('obecne.nacitam')}</p>
            ) : (
              <HudbaSeznam
                key={`${vybrana}|${firmaId}|${klic}`}
                api={{
                  ...api,
                  // Série a firma jdou s každým požadavkem - jinak by skladba
                  // nevěděla, ke které sérii patří.
                  navic: { serie: vybrana, companyId: firmaId || null },
                }}
                pocatecni={hudba}
                pripraveno={dropboxNastaven}
              />
            )}
          </>
        ) : (
          <p className="text-sm font-body text-muted m-0">{t('hudbaKnihovna.zadnaSerie')}</p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Databáze */

function Databaze({ radky }: { radky: RadekKnihovny[] }) {
  const t = usePreklad();
  const [hledani, setHledani] = useState('');

  const hledane = hledani.trim().toLowerCase();
  const videt = hledane
    ? radky.filter(
        (r) =>
          r.nazev.toLowerCase().includes(hledane) ||
          (r.autor ?? '').toLowerCase().includes(hledane) ||
          r.projekty.some((p) => p.nazev.toLowerCase().includes(hledane)) ||
          r.serie.some((s) => s.toLowerCase().includes(hledane)),
      )
    : radky;

  return (
    <div className="flex flex-col gap-3">
      <input
        value={hledani}
        onChange={(e) => setHledani(e.target.value)}
        placeholder={t('hudbaKnihovna.hledat')}
        className="max-w-sm rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
      />

      {videt.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">{t('hudbaKnihovna.nicNenalezeno')}</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {videt.map((r) => (
            <li
              key={r.cesta}
              className="rounded-card border border-line bg-surface px-4 py-3 flex flex-wrap items-center gap-3"
            >
              <span className="flex-1 min-w-[220px]">
                <span className="block font-heading font-semibold text-sm text-ink">{r.nazev}</span>
                <span className="block text-xs font-body text-muted">
                  {[r.autor || t('hudba.autorNeznamy'), delkaTextem(r.delkaS)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>

              <span className="text-xs font-body text-muted flex-1 min-w-[220px]">
                {r.serie.length > 0 && (
                  <span className="block">
                    {t('hudbaKnihovna.vSeriich')} {r.serie.join(', ')}
                  </span>
                )}
                {r.projekty.length > 0 && (
                  <span className="block">
                    {t('hudbaKnihovna.vProjektech')}{' '}
                    {r.projekty.slice(0, 3).map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ', '}
                        <Link
                          href={`/projekty/${p.id}`}
                          className="text-brand-purpleLight no-underline hover:text-ink"
                        >
                          {p.nazev}
                        </Link>
                      </span>
                    ))}
                    {r.projekty.length > 3 && ` +${r.projekty.length - 3}`}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- pomocné */

function datum(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function popisDnu(zaDni: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (zaDni < 0) return t('hudbaKnihovna.jizZacalo');
  if (zaDni === 0) return t('hudbaKnihovna.dnes');
  return t('hudbaKnihovna.zaDni', { pocet: zaDni });
}
