'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum, type Jazyk } from '@/lib/jazyk';
import type { PribehRadek } from '@/lib/pribehyServer';
import { zbyvaMinut } from '@/lib/pribehy';
import { Editor } from './Editor';
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
}: {
  pribehy: PribehRadek[];
  smiPoslat: boolean;
  /** Jméno účtu, na který to půjde - do náhledu, ať je vidět čí to bude. */
  ucet: string | null;
  jaId: string;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [otevrenyKoncept, setOtevrenyKoncept] = useState<string | null>(null);
  const [ted, setTed] = useState(() => new Date());

  // Odpocet do vyprseni - stacilo by i po minute, cas je stejne zaokrouhleny.
  useEffect(() => {
    const t = setInterval(() => setTed(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const koncepty = pribehy.filter((p) => p.stav === 'KONCEPT' && p.autorId === jaId);
  const nevyveseno = pribehy.filter((p) => p.stav === 'CEKA' || p.stav === 'ZAMITNUTO');
  const vyvesene = pribehy.filter((p) => p.stav === 'VYVESENO');
  const naInstagramu = vyvesene.filter((p) => p.vyrizenoAt && zbyvaMinut(p.vyrizenoAt, ted) !== null);
  const vyprsele = vyvesene.filter((p) => !p.vyrizenoAt || zbyvaMinut(p.vyrizenoAt, ted) === null);

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
      <div className="flex items-center gap-3">
        <Znacka velikost={46} />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 font-display text-3xl text-ink">{t('pribehy.nadpis')}</h1>
          <span className="font-body text-sm text-muted">{ucet ? `@${ucet}` : t('pribehy.bezUctu')}</span>
        </div>
      </div>

      <p className="m-0 max-w-[72ch] font-body text-sm text-muted">{t('pribehy.podnadpis')}</p>

      {smiPoslat && (
        <Editor
          key={koncept?.id ?? 'novy'}
          ucet={ucet}
          koncept={koncept}
          onHotovo={() => setOtevrenyKoncept(null)}
        />
      )}

      {koncepty.length > 0 && (
        <Sekce nadpis={`${t('pribehy.koncepty')} ${koncepty.length}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {koncepty.map((p) => (
              <Dlazdice
                key={p.id}
                p={p}
                jazyk={jazyk}
                stuha={t('pribehy.stav.KONCEPT')}
                kruh={false}
                akce={
                  <>
                    <Mala onClick={() => setOtevrenyKoncept(p.id)}>{t('pribehy.otevrit')}</Mala>
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

      {nevyveseno.length > 0 && (
        <Sekce nadpis={`${t('pribehy.neproslo')} ${nevyveseno.length}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

      {/* --- CO JE PRÁVĚ NA INSTAGRAMU ------------------------------------ */}
      <Sekce nadpis={`${t('pribehy.naInstagramu')} ${naInstagramu.length}`}>
        {naInstagramu.length === 0 ? (
          <p className="m-0 rounded-card border border-line bg-surface px-5 py-8 text-center font-body text-sm text-muted">
            {t('pribehy.nicVenku')}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
            {naInstagramu.map((p) => (
              <Radek key={p.id} p={p} jazyk={jazyk} ted={ted} />
            ))}
          </div>
        )}
      </Sekce>

      {vyprsele.length > 0 && (
        <Sekce nadpis={t('pribehy.vyprsele')}>
          <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface opacity-75">
            {vyprsele.slice(0, 20).map((p) => (
              <Radek key={p.id} p={p} jazyk={jazyk} ted={ted} />
            ))}
          </div>
        </Sekce>
      )}
    </div>
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

/** Řádek přehledu: co je venku, kdo to tam dal a za jak dlouho zmizí. */
function Radek({ p, jazyk, ted }: { p: PribehRadek; jazyk: Jazyk; ted: Date }) {
  const t = usePreklad();
  const zbyva = p.vyrizenoAt ? zbyvaMinut(p.vyrizenoAt, ted) : null;
  const zbyvaText =
    zbyva === null
      ? t('pribehy.uzPryc')
      : zbyva >= 60
        ? t('pribehy.zbyvaHodin', { h: String(Math.floor(zbyva / 60)) })
        : t('pribehy.zbyvaMinut', { m: String(zbyva) });

  return (
    <div className="flex items-center gap-3 p-3">
      <span className="shrink-0 overflow-hidden rounded-lg border border-line bg-bar">
        <span className="relative block aspect-[9/16] w-11">
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
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-heading text-sm text-ink">
          {p.popisek.trim() || t('pribehy.bezPopisku')}
        </span>
        <span className="truncate font-body text-xs text-muted">
          {t('pribehy.daltamVKolik', {
            kdo: p.vyridil || p.autor,
            datum: p.vyrizenoAt ? formatDatum(jazyk, new Date(p.vyrizenoAt)) : '—',
          })}
        </span>
      </span>

      <span
        className={`shrink-0 rounded-pill border px-2.5 py-1 font-heading text-[11px] tabular-nums ${
          zbyva === null
            ? 'border-line text-muted'
            : 'border-brand-green/50 bg-brand-green/15 text-brand-greenDeep dark:text-brand-green'
        }`}
      >
        {zbyvaText}
      </span>
    </div>
  );
}
