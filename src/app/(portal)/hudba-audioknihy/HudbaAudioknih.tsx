'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { usePreklad, useJazyk } from '@/app/(portal)/components/JazykProvider';
import { HudbaSeznam, type HudbaApi, type SkladbaVSeznamu } from '@/app/(portal)/components/HudbaSeznam';
import { WaveformPlayer } from '@/app/(portal)/components/WaveformPlayer';
import type { ProjektBezHudby, RadekKnihovny } from '@/lib/hudbaKnihovnaServer';
import { formatDatum, kodJazyka, type Jazyk } from '@/lib/jazyk';
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
  const jazyk = useJazyk();
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
            {/* SÉRIE JE VIDĚT NA PRVNÍ POHLED (zadání 17. 10. 2026: „tady by
                mělo být jasně vidět, když je to série"). Dřív splývala
                s názvem firmy na jednom řádku oddělená tečkou. */}
            <span className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="text-xs font-body text-muted">{r.firma || '—'}</span>
              {r.serie && (
                <span className="inline-flex items-center gap-1 rounded-pill border border-brand-purple/50 bg-brand-purple/15 px-2 py-0.5 text-[10px] font-heading font-semibold uppercase tracking-wide text-brand-purpleLight">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="w-3 h-3"
                    aria-hidden="true"
                  >
                    <path d="M4 7h10" />
                    <path d="M4 12h10" />
                    <path d="M4 17h16" />
                    <path d="M18 5v9" />
                  </svg>
                  {t('hudbaKnihovna.serieStitek')} {r.serie}
                </span>
              )}
            </span>
          </span>

          <span className="text-xs font-body text-muted min-w-[150px]">
            {r.prvniFrekvence ? (
              <>
                {t('hudbaKnihovna.prvniFrekvence')}{' '}
                <b className={naleha(r.zaDni) ? 'text-status-error' : 'text-ink'}>
                  {datum(jazyk, r.prvniFrekvence)}
                </b>
                {r.zaDni !== null && (
                  <span className="block">{popisDnu(r.zaDni, t)}</span>
                )}
              </>
            ) : (
              t('hudbaKnihovna.bezTerminu')
            )}
          </span>

          <span className="text-xs font-body min-w-[190px]">
            {r.hudbuDodavaKlient ? (
              <span className="text-brand-purpleLight">
                {t('hudbaKnihovna.dodavaKlient')}
                <span
                  className={`block ${r.vyzvaPujdeSama || r.vyzva?.odeslanoAt ? 'text-muted' : 'text-status-progress'}`}
                >
                  {r.vyzva?.odeslanoAt
                    ? `${t('hudbaKnihovna.vyzvaOdeslana')} ${datum(jazyk, r.vyzva.odeslanoAt)}`
                    : r.vyzvaPujdeSama
                      ? t('hudbaKnihovna.vyzvaCeka')
                      : t('hudbaKnihovna.vyzvaRucne')}
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
            {r.hudbuDodavaKlient ? t('hudbaKnihovna.otevritKartu') : t('hudbaKnihovna.vlozitHudbu')}
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
  /** Otevřená skladba. Detail je okno nad seznamem, ne skok do projektu. */
  const [detail, setDetail] = useState<RadekKnihovny | null>(null);

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
            <li key={r.cesta}>
              {/* KLIKNUTÍ OTEVŘE DETAIL SKLADBY, ne projekt (zadání
                  17. 10. 2026) - odsud se člověk dívá na hudbu, ne na knihy. */}
              <button
                type="button"
                onClick={() => setDetail(r)}
                className="w-full text-left rounded-card border border-line bg-surface px-4 py-3 flex flex-wrap items-center gap-3 cursor-pointer hover:border-brand-purpleLight transition-colors"
              >
                <Obal radek={r} maly />
                <span className="flex-1 min-w-[220px]">
                  <span className="block font-heading font-semibold text-sm text-ink">
                    {r.nazev}
                  </span>
                  <span className="block text-xs font-body text-muted">
                    {[r.autor || t('hudba.autorNeznamy'), delkaTextem(r.delkaS)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>

                <span className="text-xs font-body text-muted flex-1 min-w-[200px]">
                  {r.serie.length > 0 && (
                    <span className="block">
                      {t('hudbaKnihovna.vSeriich')} {r.serie.join(', ')}
                    </span>
                  )}
                  {r.projekty.length > 0 && (
                    <span className="block">
                      {t('hudbaKnihovna.vProjektech')}{' '}
                      {r.projekty
                        .slice(0, 3)
                        .map((p) => p.nazev)
                        .join(', ')}
                      {r.projekty.length > 3 && ` +${r.projekty.length - 3}`}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail && <DetailSkladby radek={detail} zavri={() => setDetail(null)} />}
    </div>
  );
}

function Obal({ radek, maly = false }: { radek: RadekKnihovny; maly?: boolean }) {
  const t = usePreklad();
  const velikost = maly ? 'w-10 h-10' : 'w-20 h-20';
  if (radek.maObal) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={radek.odkazObalu}
        alt={t('hudba.obalPopis')}
        className={`${velikost} rounded-lg object-cover shrink-0 bg-field`}
      />
    );
  }
  return (
    <span
      className={`${velikost} rounded-lg shrink-0 grid place-items-center bg-brand-purple/15 text-brand-purpleLight`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={maly ? 'w-4 h-4' : 'w-7 h-7'}
        aria-hidden="true"
      >
        <path d="M9 18V5l10-2v13" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
      </svg>
    </span>
  );
}

/**
 * DETAIL JEDNÉ SKLADBY (zadání 17. 10. 2026: „nemělo by se po kliknutí
 * přepnout na projekt, ale na detail toho songu zvlášť v databázi").
 *
 * Okno nad seznamem, ne vlastní stránka: člověk si v databázi prochází
 * skladby jednu po druhé a po zavření chce být tam, kde byl, ne o krok zpátky
 * v historii prohlížeče.
 */
function DetailSkladby({ radek, zavri }: { radek: RadekKnihovny; zavri: () => void }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [odkaz, setOdkaz] = useState<string | null>(null);

  useEffect(() => {
    let zahozeno = false;
    fetch(radek.odkazPolozky)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { odkaz: string } | null) => {
        if (!zahozeno && d?.odkaz) setOdkaz(d.odkaz);
      })
      .catch(() => undefined);
    return () => {
      zahozeno = true;
    };
  }, [radek.odkazPolozky]);

  useEffect(() => {
    function klavesa(e: KeyboardEvent) {
      if (e.key === 'Escape') zavri();
    }
    document.addEventListener('keydown', klavesa);
    return () => document.removeEventListener('keydown', klavesa);
  }, [zavri]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('hudbaKnihovna.detailSkladby')}
      onClick={zavri}
      className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-line rounded-card shadow-lg w-full max-w-2xl max-h-full overflow-auto p-5 flex flex-col gap-4 text-left"
      >
        <div className="flex items-start gap-4">
          <Obal radek={radek} />
          <div className="flex-1 min-w-0">
            <span className="block font-display text-2xl text-ink">{radek.nazev}</span>
            <span className="block text-sm font-body text-muted mt-0.5">
              {t('hudba.autorSkladby')} {radek.autor || t('hudba.autorNeznamy')}
            </span>
            <span className="block text-xs font-body text-muted/80 mt-1">
              {[delkaTextem(radek.delkaS), velikostTextem(jazyk, radek.velikost)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <button
            type="button"
            onClick={zavri}
            aria-label={t('obecne.zavrit')}
            className="border-0 bg-transparent text-muted hover:text-ink cursor-pointer text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>

        {odkaz ? (
          <WaveformPlayer src={odkaz} />
        ) : (
          <p className="text-sm font-body text-muted m-0">{t('obecne.nacitam')}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-[10px] font-heading uppercase tracking-wide text-muted mb-1">
              {t('hudbaKnihovna.hrajeV')}
            </span>
            {radek.projekty.length === 0 ? (
              <span className="text-xs font-body text-muted">{t('hudbaKnihovna.nikdeJinde')}</span>
            ) : (
              <ul className="list-none p-0 m-0 flex flex-col gap-1">
                {radek.projekty.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projekty/${p.id}`}
                      className="text-sm font-body text-brand-purpleLight no-underline hover:text-ink"
                    >
                      {p.nazev}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <span className="block text-[10px] font-heading uppercase tracking-wide text-muted mb-1">
              {t('hudbaKnihovna.jeVSeriich')}
            </span>
            {radek.serie.length === 0 ? (
              <span className="text-xs font-body text-muted">—</span>
            ) : (
              <ul className="list-none p-0 m-0 flex flex-col gap-1">
                {radek.serie.map((x) => (
                  <li key={x} className="text-sm font-body text-ink">
                    {x}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Velikost souboru podle jazyka (dávka 7n). Desetinná čárka tu byla natvrdo,
 * takže v anglickém portálu stálo „3,5 MB" - britsky je to „3.5 MB"
 * (pravidlo 3, desetinná tečka). Čísla formátuje `Intl`, ne `replace`.
 */
function velikostTextem(jazyk: Jazyk, bytes: number): string {
  if (bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} kB`;
  return `${new Intl.NumberFormat(kodJazyka(jazyk), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(mb)} MB`;
}

/* -------------------------------------------------------------- pomocné */

/** Datum podle jazyka (dávka 7n) - dřív se skládalo natvrdo česky. */
function datum(jazyk: Jazyk, iso: string): string {
  return formatDatum(jazyk, new Date(iso));
}

function popisDnu(zaDni: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (zaDni < 0) return t('hudbaKnihovna.jizZacalo');
  if (zaDni === 0) return t('hudbaKnihovna.dnes');
  return t('hudbaKnihovna.zaDni', { pocet: zaDni });
}
