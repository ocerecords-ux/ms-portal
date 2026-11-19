'use client';

import { useState } from 'react';

import { usePreklad, useJazyk } from '@/app/(portal)/components/JazykProvider';
import { hlaskaChyby } from '@/lib/chybaZOdpovedi';
import { formatDatum, formatDatumCas, type Jazyk } from '@/lib/jazyk';
import type { StavVyzvy } from '@/lib/vyzvaHudbaServer';

/**
 * VÝZVA KLIENTOVI NA TRACKLIST (zadání 19. 11. 2026: „tady bych chtěl mít
 * možnost poslat notifikaci klientovi ... v tom ručním módu bych to udělal
 * zvlášť na hudbu a zvlášť na tracklist").
 *
 * Panel je stejný jako u hudby, jen se ptá na tracklist. Dvě věci se liší:
 *  - TLAČÍTKO POSÍLÁ SAMOSTATNÝ MAIL, jen o tracklistu. Automatická výzva tři
 *    dny před první frekvencí jde dál na obojí naráz, ať klienta neobtěžujeme
 *    dvakrát - viz lib/vyzvaHudbaServer.ts.
 *  - HOTOVO ZNAMENÁ „KLIENT TRACKLIST VYPLNIL", ne že vložil hudbu.
 */
export function VyzvaTracklistu({
  caflouProjectId,
  vyzva,
  maTracklist,
}: {
  caflouProjectId: string;
  vyzva: StavVyzvy | null;
  /** V tabulce už nějaké stopy jsou - ať panel nevybízí k tomu, co je hotové. */
  maTracklist: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [stav, setStav] = useState<StavVyzvy | null>(vyzva);
  const [posila, setPosila] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);

  async function posli() {
    setPosila(true);
    setHlaska(null);
    const res = await fetch(`/api/projekty/${caflouProjectId}/tracklist/vyzva`, {
      method: 'POST',
    }).catch(() => null);
    setPosila(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setHlaska(hlaskaChyby(data, t, t('hudbaVyzva.chyba')));
      return;
    }
    const data = (await res.json()) as { vyzva: StavVyzvy };
    setStav(data.vyzva);
    setHlaska(t('hudbaVyzva.odeslano'));
  }

  const hotovo = Boolean(stav?.tracklistAt) || maTracklist;

  return (
    <div
      className={`rounded-card border px-4 py-3 flex flex-col gap-2 ${
        hotovo ? 'border-brand-green/40 bg-brand-green/10' : 'border-line bg-surface'
      }`}
    >
      <span className="font-heading font-semibold text-sm text-ink">
        {hotovo ? t('tracklistVyzva.hotovo') : t('tracklistVyzva.nadpis')}
      </span>

      <ul className="list-none p-0 m-0 flex flex-col gap-1 text-xs font-body text-muted">
        <li>
          {t('hudbaVyzva.komu')}:{' '}
          <b className={stav?.email ? 'text-ink' : 'text-status-progress'}>
            {stav?.email ?? t('hudbaVyzva.bezKontaktu')}
          </b>
          {stav?.jmeno ? ` (${stav.jmeno})` : ''}
        </li>
        <li>
          {stav?.tracklistVyzvaAt
            ? `${t('tracklistVyzva.odeslanaKdy')} ${datumCas(jazyk, stav.tracklistVyzvaAt)}`
            : stav?.odejdeAt
              ? `${t('tracklistVyzva.odejdeSOhudbou')} ${datum(jazyk, stav.odejdeAt)}`
              : t('tracklistVyzva.jesteNesla')}
        </li>
        {stav?.tracklistAt && (
          <li className="text-ink">
            {t('tracklistVyzva.vyplnilKdy')} {datumCas(jazyk, stav.tracklistAt)}
            {stav.tracklistJmeno ? ` · ${stav.tracklistJmeno}` : ''}
          </li>
        )}
      </ul>

      <span className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={posli}
          disabled={posila || !stav?.email}
          className="rounded-pill border-0 bg-brand-purple px-4 py-1.5 text-xs font-heading font-semibold text-white cursor-pointer hover:bg-brand-purpleDark transition-colors disabled:opacity-60"
        >
          {stav?.tracklistVyzvaAt
            ? t('tracklistVyzva.poslatZnovu')
            : t('tracklistVyzva.poslatHned')}
        </button>
        {stav?.odkaz && (
          <a
            href={stav.odkaz}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-heading text-brand-purpleLight no-underline hover:text-ink"
          >
            {t('hudbaVyzva.otevritOdkaz')}
          </a>
        )}
        {hlaska && <span className="text-xs font-body text-muted">{hlaska}</span>}
      </span>

      <p className="text-[11px] font-body text-muted m-0">{t('tracklistVyzva.vysvetleni')}</p>
    </div>
  );
}

/** Datum a čas podle jazyka (pravidlo 8) - jsou to modulové funkce bez hooku. */
function datum(jazyk: Jazyk, iso: string): string {
  return formatDatum(jazyk, new Date(iso));
}

function datumCas(jazyk: Jazyk, iso: string): string {
  return formatDatumCas(jazyk, new Date(iso));
}
