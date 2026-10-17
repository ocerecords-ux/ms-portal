'use client';

import { useState } from 'react';

import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { HudbaSeznam, type HudbaApi } from '@/app/(portal)/components/HudbaSeznam';
import type { SkladbaProjektu } from '@/lib/hudbaProjektuServer';
import type { StavVyzvy } from '@/lib/vyzvaHudbaServer';

/**
 * HUDBA VYBRANÁ PRO PROJEKT (zadání 16. 10. 2026: „potřebuju u projektů mít
 * kartu, kde budu vkládat hudbu, kterou vyberu pro daný projekt").
 *
 * Samotná práce se skladbami je ve společné komponentě HudbaSeznam - úplně
 * stejně se hudba vkládá i u série. Tady zůstává to, čím se karta projektu
 * liší: adresy, na které se ptá, a STAV VÝZVY KLIENTOVI u firem, kde hudbu
 * vybíráme ne my, ale klient (zadání 17. 10. 2026).
 */
export function HudbaSekce({
  caflouProjectId,
  pocatecni,
  dropboxNastaven,
  hudbuDodavaKlient = false,
  vyzvaPujdeSama = false,
  vyzva = null,
}: {
  caflouProjectId: string;
  pocatecni: SkladbaProjektu[];
  /** Když chybí klíče, karta to řekne rovnou místo tichého selhání. */
  dropboxNastaven: boolean;
  hudbuDodavaKlient?: boolean;
  /** U projektů starších než zaškrtnutí u firmy výzva sama neodejde. */
  vyzvaPujdeSama?: boolean;
  vyzva?: StavVyzvy | null;
}) {
  const t = usePreklad();
  const zaklad = `/api/projekty/${caflouProjectId}/hudba`;
  const api: HudbaApi = {
    podpis: `${zaklad}/podpis`,
    obalPodpis: `${zaklad}/obal-podpis`,
    zapis: zaklad,
    polozka: (id) => `${zaklad}/${id}`,
    obal: (id) => `${zaklad}/${id}/obal`,
    // Skladby vložené dřív, než portál uměl číst štítky, si je dotáhnou samy.
    doctiMetadata: (id) => `${zaklad}/${id}/metadata`,
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-body text-muted m-0">{t('hudba.popis')}</p>

      {hudbuDodavaKlient && (
        <VyzvaKlientovi
          caflouProjectId={caflouProjectId}
          vyzva={vyzva}
          pujdeSama={vyzvaPujdeSama}
          maHudbu={pocatecni.length > 0}
        />
      )}

      <HudbaSeznam api={api} pocatecni={pocatecni} pripraveno={dropboxNastaven} />
    </div>
  );
}

/**
 * STAV VÝZVY KLIENTOVI. Kdy odejde, kdy odešla a kdo hudbu vložil - aby se
 * nikdo nemusel ptát v mailu, jestli už se někdo ozval. Výzva odchází sama
 * tři dny před první frekvencí; tlačítkem jde poslat dřív.
 */
function VyzvaKlientovi({
  caflouProjectId,
  vyzva,
  pujdeSama,
  maHudbu,
}: {
  caflouProjectId: string;
  vyzva: StavVyzvy | null;
  pujdeSama: boolean;
  maHudbu: boolean;
}) {
  const t = usePreklad();
  const [stav, setStav] = useState<StavVyzvy | null>(vyzva);
  const [posila, setPosila] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);

  async function posli() {
    setPosila(true);
    setHlaska(null);
    const res = await fetch(`/api/projekty/${caflouProjectId}/hudba/vyzva`, {
      method: 'POST',
    }).catch(() => null);
    setPosila(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      setHlaska(data?.error || t('hudbaVyzva.chyba'));
      return;
    }
    const data = (await res.json()) as { vyzva: StavVyzvy };
    setStav(data.vyzva);
    setHlaska(t('hudbaVyzva.odeslano'));
  }

  const vlozeno = Boolean(stav?.vlozenoAt) || maHudbu;

  return (
    <div
      className={`rounded-card border px-4 py-3 flex flex-col gap-2 ${
        vlozeno ? 'border-brand-green/40 bg-brand-green/10' : 'border-line bg-surface'
      }`}
    >
      <span className="font-heading font-semibold text-sm text-ink">
        {vlozeno ? t('hudbaVyzva.hotovo') : t('hudbaVyzva.nadpis')}
      </span>

      <ul className="list-none p-0 m-0 flex flex-col gap-1 text-xs font-body text-muted">
        <li>
          {t('hudbaVyzva.komu')}:{' '}
          <b className={stav?.email ? 'text-ink' : 'text-status-progress'}>
            {stav?.email ?? t('hudbaVyzva.bezKontaktu')}
          </b>
          {stav?.jmeno ? ` (${stav.jmeno})` : ''}
        </li>
        <li className={!stav?.odeslanoAt && !pujdeSama ? 'text-status-progress' : undefined}>
          {stav?.odeslanoAt
            ? `${t('hudbaVyzva.odeslanaKdy')} ${datumCas(stav.odeslanoAt)}`
            : !pujdeSama
              ? t('hudbaVyzva.samaNepujde')
              : stav?.odejdeAt
                ? `${t('hudbaVyzva.odejde')} ${datum(stav.odejdeAt)}`
                : t('hudbaVyzva.jesteNesla')}
        </li>
        {stav?.vlozenoAt && (
          <li className="text-ink">
            {t('hudbaVyzva.vlozilKdy')} {datumCas(stav.vlozenoAt)}
            {stav.vlozilJmeno ? ` · ${stav.vlozilJmeno}` : ''}
          </li>
        )}
      </ul>

      {!vlozeno && (
        <span className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={posli}
            disabled={posila || !stav?.email}
            className="rounded-pill border-0 bg-brand-purple px-4 py-1.5 text-xs font-heading font-semibold text-white cursor-pointer hover:bg-brand-purpleDark transition-colors disabled:opacity-60"
          >
            {stav?.odeslanoAt ? t('hudbaVyzva.poslatZnovu') : t('hudbaVyzva.poslatHned')}
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
      )}

      <p className="text-[11px] font-body text-muted m-0">{t('hudbaVyzva.vysvetleni')}</p>
    </div>
  );
}

function datum(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function datumCas(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} v ${d.getHours()}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}
