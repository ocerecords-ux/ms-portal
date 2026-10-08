'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum, type Jazyk } from '@/lib/jazyk';
import type { PribehRadek } from '@/lib/pribehyServer';
import { zbyvaMinut } from '@/lib/pribehy';
import { Editor } from './Editor';
import { Hudba } from './Hudba';
import { KROUZEK, KROUZEK_KLID, Znacka } from './spolecne';

/**
 * PŘÍBĚHY NA INSTAGRAM (zadání 6. 10. 2026: „tohle se musí chovat jak
 * zjednodušený instagram… pole textu bude nalevo a ten náhled napravo. A pod
 * tím bude přehled toho, co se dalo na instagram a kdy to vyprší a kdo to tam
 * dal. A nemusíme to nechávat schvalovat").
 *
 * NAHOŘE SE TVOŘÍ, DOLE SE KOUKÁ. Editor (text vlevo, náhled vpravo), pod ním
 * koncepty, pak co je PRÁVĚ NA INSTAGRAMU i s tím, za jak dlouho to zmizí,
 * a nakonec co už vypršelo.
 *
 * ODPOČET BĚŽÍ V PROHLÍŽEČI. Příběh mizí po 24 hodinách a stránka se kvůli
 * tomu nepřenačítá - zbývající čas se přepočítá každou minutu.
 */

export function FrontaPribehu({
  pribehy,
  smiPoslat,
  ucet,
  jaId,
  smiSpravovatHudbu = false,
  rovnouSkladam = false,
}: {
  pribehy: PribehRadek[];
  smiPoslat: boolean;
  /** Jméno účtu, na který to půjde - do náhledu, ať je vidět čí to bude. */
  ucet: string | null;
  jaId: string;
  /** Smí měnit knihovnu hudby? Pak se pod editorem ukáže její správa. */
  smiSpravovatHudbu?: boolean;
  /**
   * Přišlo se přes ikonu Instagramu na telefonu, takže se má rovnou
   * otevřít prázdný rámeček (8. 10. 2026) - jinak by se „+“ máčklo dvakrát.
   */
  rovnouSkladam?: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [otevrenyKoncept, setOtevrenyKoncept] = useState<string | null>(null);
  const [ted, setTed] = useState(() => new Date());
  const [ukazKoncepty, setUkazKoncepty] = useState(false);
  /**
   * CELÁ OBRAZOVKA NA TELEFONU (zadání 7. 10. 2026: „v mobilu to musíme
   * udělat jinak. Musíme to roztáhnout na celou obrazovku s možností se
   * vrátit. Jako bych byl na Instagramu").
   *
   * Na telefonu se nejdřív kouká (mřížka toho, co je venku) a skládá se
   * až po klepnutí na plovoucí „+". Na počítači tenhle stav nic neřídí -
   * editor tam stojí na stránce pořád (viz třídy níže).
   */
  const [skladam, setSkladam] = useState(rovnouSkladam && smiPoslat);

  /**
   * Dokud je na telefonu skládání přes celou obrazovku, stránka pod ním se
   * nerolá - jinak by pod prstem ujížděla mřížka místo textu na příběhu.
   */
  useEffect(() => {
    if (!skladam) return;
    const puvodni = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = puvodni;
    };
  }, [skladam]);

  // Odpocet do vyprseni - stacilo by i po minute, cas je stejne zaokrouhleny.
  useEffect(() => {
    const t = setInterval(() => setTed(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const koncepty = pribehy.filter((p) => p.stav === 'KONCEPT' && p.autorId === jaId);
  const nevyveseno = pribehy.filter((p) => p.stav === 'CEKA' || p.stav === 'ZAMITNUTO');
  const vyvesene = pribehy.filter((p) => p.stav === 'VYVESENO');
  /**
   * JEN CO JE OPRAVDU VENKU (zadání 8. 10. 2026: „A když už je fotka pryč,
   * tak už to musí zmizet“). Přepočítává se při každém tiknutí `ted`, takže
   * příběh z mřížky zmizí sám, i když stránka zůstane otevřená.
   */
  const naInstagramu = vyvesene.filter((p) => p.vyrizenoAt && zbyvaMinut(p.vyrizenoAt, ted) !== null);

  const koncept = koncepty.find((p) => p.id === otevrenyKoncept) ?? null;

  async function smaz(id: string) {
    await fetch(`/api/site/pribehy/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function zkusZnovu(id: string) {
    await fetch(`/api/site/pribehy/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stav: 'VYVESENO', pres: 'API' }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-7">
      {/* PLOVOUCÍ „+" JEN NA TELEFONU (7. 10. 2026). Stejné gesto jako na
          Instagramu: nejdřív je vidět, co je venku, a příběh se zakládá
          odsud. Když už je skládání otevřené, tlačítko zmizí. */}
      {smiPoslat && !skladam && (
        <button
          type="button"
          onClick={() => {
            setOtevrenyKoncept(null);
            setSkladam(true);
          }}
          aria-label={t('pribehy.novy')}
          title={t('pribehy.novy')}
          className="fixed bottom-5 right-5 z-50 grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-brand-purple font-display text-3xl leading-none text-white shadow-lg transition-colors hover:bg-brand-purpleDeep md:hidden"
        >
          +
        </button>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Znacka velikost={46} />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 font-display text-3xl text-ink">{t('pribehy.nadpis')}</h1>
          <span className="font-body text-sm text-muted">{ucet ? `@${ucet}` : t('pribehy.bezUctu')}</span>
        </div>

        {/**
         * KONCEPTY SE OTEVÍRAJÍ ODSUD (6. 10. 2026: „dal bych nahoru někde
         * tlačítko, kde otevřu koncepty"). Dole pod editorem visely pořád
         * a tlačily přehled níž; tady jsou po ruce a nepřekážejí.
         */}
        {smiPoslat && (
          <button
            type="button"
            disabled={koncepty.length === 0}
            onClick={() => setUkazKoncepty((o) => !o)}
            aria-expanded={ukazKoncepty}
            className={`ml-auto flex cursor-pointer items-center gap-2 rounded-pill border px-4 py-2 font-heading text-sm transition-colors disabled:cursor-default disabled:opacity-50 ${
              ukazKoncepty
                ? 'border-brand-purple bg-brand-purple/15 text-ink'
                : 'border-line text-ink hover:border-brand-purple'
            }`}
          >
            {t('pribehy.koncepty')}
            <span
              className={`grid min-w-[22px] place-items-center rounded-pill px-1.5 font-heading text-xs font-semibold tabular-nums ${
                koncepty.length > 0 ? 'bg-brand-green text-onAccent' : 'bg-field text-muted'
              }`}
            >
              {koncepty.length}
            </span>
          </button>
        )}
      </div>

      {ukazKoncepty && koncepty.length > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-4 lg:grid-cols-6">
          {koncepty.map((p) => (
            <Dlazdice
              key={p.id}
              p={p}
              jazyk={jazyk}
              stuha={t('pribehy.stav.KONCEPT')}
              kruh={false}
              akce={
                <>
                  <Mala
                    onClick={() => {
                      setOtevrenyKoncept(p.id);
                      setUkazKoncepty(false);
                      setSkladam(true);
                    }}
                  >
                    {t('pribehy.otevrit')}
                  </Mala>
                  <Mala onClick={() => void smaz(p.id)} nebezpecna>
                    {t('pribehy.smazat')}
                  </Mala>
                </>
              }
            />
          ))}
        </div>
      )}

      {/**
       * VLEVO SE TVOŘÍ, VPRAVO SE KOUKÁ (6. 10. 2026: „s tím náhledem by to
       * mohlo být v levé části obrazovky a v pravé by byl rastr 3×3 s těmi
       * zveřejněnými příspěvky a stavem").
       *
       * MŘÍŽKA MÁ VŽdYCKY DEVĚT OKEN, i když jsou venku dvě fotky - prázdná
       * místa jsou součástí sdělení. Na užším okně se sloupce složí pod sebe.
       */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-6">
          {/**
           * JEDEN EDITOR, DVĚ PODOBY. Na počítači (`md:`) obal nic neřeší -
           * editor stojí v levém sloupci jako dřív. Na telefonu je z něj
           * překryv přes celou obrazovku, který se otevírá plovoucím „+".
           *
           * ŘÍDÍ TO TŘÍDA, NE JAVASCRIPT: měřit šířku okna až v prohlížeči by
           * znamenalo, že se po načtení layout překreslí. Editor se tak
           * vykreslí jen jednou - rozepsaný text a vybraná fotka přežijí
           * zavření i otevření.
           */}
          {smiPoslat && (
            <div
              className={`${
                skladam ? 'flex' : 'hidden'
              } fixed inset-0 z-[70] flex-col overflow-hidden overscroll-contain bg-paper md:static md:z-auto md:flex md:overflow-visible md:bg-transparent`}
            >
              <Editor
                key={koncept?.id ?? 'novy'}
                ucet={ucet}
                koncept={koncept}
                onHotovo={() => {
                  setOtevrenyKoncept(null);
                  setSkladam(false);
                }}
                onZavri={() => setSkladam(false)}
              />
              {/* SPRÁVA HUDBY (8. 10. 2026) - už tady, ne v Administraci:
                  skladba se přidává právě ve chvíli, kdy chybí u rozdělaného
                  příběhu, a odcházet kvůli tomu ze stránky by znamenalo přijít
                  o rozepsaný text. */}
              {smiSpravovatHudbu && (
                <div className="shrink-0 px-4 pb-4 md:px-0 md:pb-0">
                  <Hudba />
                </div>
              )}
            </div>
          )}

          {nevyveseno.length > 0 && (
            <Sekce nadpis={`${t('pribehy.neproslo')} ${nevyveseno.length}`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {nevyveseno.map((p) => (
                  <Dlazdice
                    key={p.id}
                    p={p}
                    jazyk={jazyk}
                    stuha={p.vzkaz ?? t('pribehy.stav.CEKA')}
                    kruh
                    akce={
                      <>
                        <Mala onClick={() => void zkusZnovu(p.id)}>{t('pribehy.zkusitZnovu')}</Mala>
                        <Mala onClick={() => void smaz(p.id)} nebezpecna>
                          {t('pribehy.smazat')}
                        </Mala>
                      </>
                    }
                  />
                ))}
              </div>
            </Sekce>
          )}
        </div>

        {/* --- VPRAVO: mřížka 3×3 s tím, co je venku -------------------- */}
        <div className="flex flex-col gap-3">
          <h2 className="m-0 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            {t('pribehy.naInstagramu')}{' '}
            <span className="tabular-nums text-brand-greenDeep dark:text-brand-green">
              {naInstagramu.length}
            </span>
          </h2>
          <div data-mrizka className="grid w-full grid-cols-3 gap-2 lg:w-[330px]">
            {Array.from({ length: 9 }, (_, i) => naInstagramu[i] ?? null).map((p, i) =>
              p ? (
                <Okno key={p.id} p={p} jazyk={jazyk} ted={ted} />
              ) : (
                <span
                  key={`prazdne-${i}`}
                  aria-label={t('pribehy.prazdneMisto')}
                  className="block aspect-[9/16] rounded-[14px] border border-dashed border-line/70"
                />
              ),
            )}
          </div>
          {naInstagramu.length === 0 && (
            <p className="m-0 font-body text-xs text-muted">{t('pribehy.nicVenku')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Jedno okno mřížky: fotka, stav a kdo ji tam dal. Zelený štítek znamená
 * „ještě je vidět", šedý už vypršel a celé okno zeslábne.
 */
function Okno({ p, jazyk, ted }: { p: PribehRadek; jazyk: Jazyk; ted: Date }) {
  const t = usePreklad();
  const zbyva = p.vyrizenoAt ? zbyvaMinut(p.vyrizenoAt, ted) : null;
  const zive = zbyva !== null;
  const stav = !zive
    ? t('pribehy.uzPryc')
    : zbyva >= 60
      ? t('pribehy.zbyvaHodin', { h: String(Math.floor(zbyva / 60)) })
      : t('pribehy.zbyvaMinut', { m: String(zbyva) });

  return (
    <span
      title={`${p.popisek.trim() || t('pribehy.bezPopisku')} — ${t('pribehy.daltamVKolik', {
        kdo: p.vyridil || p.autor,
        datum: p.vyrizenoAt ? formatDatum(jazyk, new Date(p.vyrizenoAt)) : '—',
      })}`}
      className={`relative block aspect-[9/16] overflow-hidden rounded-[14px] bg-bar ${zive ? '' : 'opacity-60'}`}
    >
      {p.jeVideo ? (
        <video
          src={`/api/site/pribehy/${p.id}/soubor`}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={`/api/site/pribehy/${p.id}/soubor`} alt="" className="h-full w-full object-cover" />
      )}
      <span
        className={`absolute left-1.5 top-1.5 rounded-pill px-1.5 py-0.5 font-heading text-[10px] tabular-nums backdrop-blur-sm ${
          zive ? 'bg-brand-green text-onAccent' : 'bg-black/60 text-white/80'
        }`}
      >
        {stav}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-6">
        <span className="block truncate font-heading text-[10px] text-white">{p.vyridil || p.autor}</span>
      </span>
    </span>
  );
}

function Sekce({ nadpis, children }: { nadpis: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 font-heading text-sm font-semibold uppercase tracking-wide text-muted">{nadpis}</h2>
      {children}
    </section>
  );
}

function Mala({
  children,
  onClick,
  nebezpecna,
}: {
  children: React.ReactNode;
  onClick: () => void;
  nebezpecna?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-pill border px-2.5 py-1 font-heading text-[11px] transition-colors ${
        nebezpecna ? 'border-line text-danger hover:border-danger' : 'border-line text-ink hover:border-brand-purple'
      }`}
    >
      {children}
    </button>
  );
}

/** Svislá dlaždice 9:16 - koncepty a to, co neprošlo. */
function Dlazdice({
  p,
  jazyk,
  stuha,
  kruh,
  akce,
}: {
  p: PribehRadek;
  jazyk: Jazyk;
  stuha: string;
  kruh: boolean;
  akce: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`block rounded-[22px] p-[2px] ${kruh ? KROUZEK : KROUZEK_KLID}`}>
        <span className="relative block aspect-[9/16] overflow-hidden rounded-[20px] bg-bar">
          {p.jeVideo ? (
            <video
              src={`/api/site/pribehy/${p.id}/soubor`}
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/site/pribehy/${p.id}/soubor`} alt="" className="h-full w-full object-cover" />
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-8">
            <span className="block truncate font-heading text-[11px] font-semibold text-white">{p.autor}</span>
            <span className="block truncate font-body text-[10px] text-white/70">
              {formatDatum(jazyk, new Date(p.createdAt))}
            </span>
          </span>
          <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-pill bg-black/60 px-2 py-0.5 font-heading text-[10px] text-white backdrop-blur-sm">
            {stuha}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap gap-1">{akce}</span>
    </div>
  );
}
