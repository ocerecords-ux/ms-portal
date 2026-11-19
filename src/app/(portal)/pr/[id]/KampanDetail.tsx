'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BARVA_STAVU_MEDIA,
  DRUHY_MEDIA,
  STAVY_MEDIA,
  jeVPohybu,
  type DruhMedia,
  type Kampan,
  type Medium,
  type StavMedia,
  type Ukol,
} from '@/lib/ema';
import { formatDatumCas, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * KAMPAŇ V SEKCI PR (zadání 19. 11. 2026: „chci ji ovládat z MS portálu
 * a vidět, co tam dělá").
 *
 * Tři věci na jedné obrazovce:
 *  - ZADÁNÍ pro Emu a pod ním historie - co jsme chtěli a co vrátila;
 *  - PRŮBĚH běžícího úkolu, ať je vidět, že se něco děje (ptá se po dvou
 *    vteřinách, dokud úkol běží, a pak přestane);
 *  - SEZNAM MÉDIÍ se stavem od návrhu po „vyšlo". Portál sám nic neodesílá -
 *    „nabídnuto" se odškrtne, až to člověk opravdu pošle.
 */

const POLE =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

export function KampanDetail({
  jazyk,
  kampan,
  pocatecniUkoly,
  pocatecniMedia,
}: {
  jazyk: Jazyk;
  kampan: Kampan;
  pocatecniUkoly: Ukol[];
  pocatecniMedia: Medium[];
}) {
  const t = (k: string, h?: Record<string, string | number>) =>
    h ? prelozitS(jazyk, k, h) : prelozit(jazyk, k);
  const [ukoly, setUkoly] = useState<Ukol[]>(pocatecniUkoly);
  const [media, setMedia] = useState<Medium[]>(pocatecniMedia);
  const [zadani, setZadani] = useState('');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [bezici, setBezici] = useState<string | null>(
    pocatecniUkoly.find((u) => jeVPohybu(u.stav))?.id ?? null,
  );

  /**
   * PTANÍ NA STAV. Dokud úkol běží, obrazovka se po dvou vteřinách ptá, co
   * Ema dělá; jakmile je hotovo, ptaní skončí. Nic se tím neukládá.
   */
  const nactiUkol = useCallback(async (id: string) => {
    const res = await fetch(`/api/pr/ukoly/${encodeURIComponent(id)}`).catch(() => null);
    if (!res?.ok) return null;
    const data = (await res.json()) as { ukol: Ukol };
    return data.ukol;
  }, []);

  useEffect(() => {
    if (!bezici) return;
    let platne = true;
    const casovac = setInterval(async () => {
      const u = await nactiUkol(bezici);
      if (!platne || !u) return;
      setUkoly((p) => {
        const uz = p.some((x) => x.id === u.id);
        return uz ? p.map((x) => (x.id === u.id ? u : x)) : [u, ...p];
      });
      if (!jeVPohybu(u.stav)) {
        setBezici(null);
        void nactiMedia();
      }
    }, 2000);
    return () => {
      platne = false;
      clearInterval(casovac);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bezici, nactiUkol]);

  /**
   * CO EMA PRÁVĚ DĚLÁ (zadání 19. 11. 2026: „ať vidím, že na něčem dělá").
   *
   * Běh trvá klidně minutu a po tu dobu se na obrazovce nic neměnilo. Teď
   * je nahoře u jména vidět poslední krok a kolik času už na tom Ema je -
   * kroky chodí ze serveru (viz lib/emaAgent.ts), čas si tiká okno samo.
   */
  const ukolVPohybu = ukoly.find((u) => jeVPohybu(u.stav)) ?? null;
  const posledniKrok = ukolVPohybu
    ? (ukolVPohybu.kroky[ukolVPohybu.kroky.length - 1] ?? t('pr.zacinam'))
    : null;
  const [tikot, setTikot] = useState(0);
  useEffect(() => {
    if (!ukolVPohybu) {
      setTikot(0);
      return;
    }
    const zacatek = new Date(ukolVPohybu.createdAt).getTime();
    const prepocti = () => setTikot(Math.max(0, Math.round((Date.now() - zacatek) / 1000)));
    prepocti();
    const casovac = setInterval(prepocti, 1000);
    return () => clearInterval(casovac);
  }, [ukolVPohybu?.id, ukolVPohybu?.createdAt]);

  const nactiMedia = useCallback(async () => {
    const res = await fetch(`/api/pr/kampane/${encodeURIComponent(kampan.id)}/media`).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { media: Medium[] };
    setMedia(data.media);
  }, [kampan.id]);

  async function posliZadani() {
    const text = zadani.trim();
    if (!text || bezi) return;
    setBezi(true);
    setChyba(null);
    /**
     * Běh může trvat minuty, takže se na odpověď nečeká se zatajeným dechem:
     * hned se začne ptát na stav a obrazovka ukazuje průběh.
     */
    const docasny: Ukol = {
      id: 'docasny',
      zadani: text,
      stav: 'BEZI',
      vystup: null,
      chyba: null,
      kroky: [t('pr.zacinam')],
      hledani: 0,
      zadalJmeno: null,
      createdAt: new Date().toISOString(),
      hotovoAt: null,
    };
    setUkoly((p) => [docasny, ...p]);
    setZadani('');

    const res = await fetch(`/api/pr/kampane/${encodeURIComponent(kampan.id)}/ukoly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zadani: text }),
    }).catch(() => null);
    setBezi(false);
    if (!res?.ok) {
      setUkoly((p) => p.filter((u) => u.id !== 'docasny'));
      setChyba(t('pr.emaNeslo'));
      return;
    }
    const data = (await res.json()) as { ukolId: string; ukoly: Ukol[] };
    setUkoly(data.ukoly);
    setBezici(data.ukoly.find((u) => jeVPohybu(u.stav))?.id ?? null);
    void nactiMedia();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">{kampan.nazev}</h1>
        {kampan.brief && (
          <p className="text-sm font-body text-muted m-0 mt-2 whitespace-pre-wrap">{kampan.brief}</p>
        )}
      </div>

      {/* ZADÁNÍ PRO EMU */}
      <div className="rounded-card border border-line bg-field p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative shrink-0 grid place-items-center">
            {/* KROUŽEK KOLEM AVATARU se rozbliká, dokud Ema pracuje. */}
            {ukolVPohybu && (
              <span className="absolute inset-0 rounded-full border-2 border-brand-purple animate-ping" />
            )}
            <span className="relative w-9 h-9 rounded-full grid place-items-center bg-brand-purple text-white font-heading font-bold text-sm">
              EP
            </span>
          </span>
          <span className="flex flex-col min-w-0">
            <span className="flex items-center gap-1.5 font-heading font-semibold text-sm text-ink">
              {t('pr.ema')}
              {ukolVPohybu && (
                <span className="flex items-end gap-0.5 pb-0.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-brand-purple animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              )}
            </span>
            <span className="text-[11px] font-body text-muted truncate">
              {ukolVPohybu ? `${posledniKrok} · ${cas(tikot)}` : t('pr.emaRole')}
            </span>
          </span>
        </div>
        <textarea
          value={zadani}
          onChange={(e) => setZadani(e.target.value)}
          rows={5}
          placeholder={t('pr.zadaniPriklad')}
          className={`${POLE} resize-y`}
        />
        <span className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={posliZadani}
            disabled={bezi || !zadani.trim()}
            className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
          >
            {bezi ? t('pr.posilam') : t('pr.zadat')}
          </button>
          {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}
        </span>
      </div>

      {/* HISTORIE ÚKOLŮ */}
      <div className="flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('pr.historie')}
        </h2>
        {ukoly.length === 0 && <p className="text-sm font-body text-muted m-0">{t('pr.zadneUkoly')}</p>}
        {ukoly.map((u) => (
          <div key={u.id} className="rounded-card border border-line bg-surface px-4 py-3 flex flex-col gap-2">
            <span className="flex items-baseline gap-3 flex-wrap">
              <span className="font-heading font-semibold text-sm text-ink grow">{u.zadani}</span>
              <span className="text-[11px] font-body text-muted">
                {formatDatumCas(jazyk, new Date(u.createdAt))}
                {u.zadalJmeno ? ` · ${u.zadalJmeno}` : ''}
                {u.hledani > 0 ? ` · ${t('pr.hledani', { pocet: u.hledani })}` : ''}
              </span>
            </span>

            {jeVPohybu(u.stav) && (
              <ul className="list-none p-0 m-0 flex flex-col gap-1">
                {(u.kroky.length ? u.kroky : [t('pr.zacinam')]).map((k, i, pole) => {
                  const posledni = i === pole.length - 1;
                  return (
                    <li
                      key={i}
                      className={`text-xs font-body flex items-center gap-1.5 ${
                        posledni ? 'text-ink' : 'text-muted'
                      }`}
                    >
                      <span>{posledni ? '▸' : '·'}</span>
                      <span>{k}</span>
                      {posledni && (
                        <span className="flex items-end gap-0.5 pb-0.5" aria-hidden>
                          {[0, 1, 2].map((d) => (
                            <span
                              key={d}
                              className="w-1 h-1 rounded-full bg-brand-purple animate-bounce"
                              style={{ animationDelay: `${d * 0.15}s` }}
                            />
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {u.stav === 'CHYBA' && (
              <span className="text-xs font-body text-danger">{u.chyba ?? t('pr.emaNeslo')}</span>
            )}

            {u.vystup && (
              <div className="text-sm font-body text-ink whitespace-pre-wrap border-t border-line pt-2">
                {u.vystup}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MÉDIA */}
      <SeznamMedii jazyk={jazyk} kampanId={kampan.id} media={media} onZmena={setMedia} />
    </div>
  );
}

function SeznamMedii({
  jazyk,
  kampanId,
  media,
  onZmena,
}: {
  jazyk: Jazyk;
  kampanId: string;
  media: Medium[];
  onZmena: (m: Medium[]) => void;
}) {
  const t = (k: string) => prelozit(jazyk, k);
  const [nazev, setNazev] = useState('');
  const [druh, setDruh] = useState<DruhMedia>('PODCAST');
  const [kontakt, setKontakt] = useState('');
  const zaklad = `/api/pr/kampane/${encodeURIComponent(kampanId)}/media`;

  async function pridej() {
    if (!nazev.trim()) return;
    const res = await fetch(zaklad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev, druh, kontakt }),
    }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { media: Medium[] };
    onZmena(data.media);
    setNazev('');
    setKontakt('');
  }

  async function zmen(id: string, zmena: Partial<Medium>) {
    const res = await fetch(`${zaklad}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zmena),
    }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { media: Medium[] };
    onZmena(data.media);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
        {t('pr.media')}
      </h2>
      <p className="text-xs font-body text-muted m-0">{t('pr.mediaPopis')}</p>

      {media.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {media.map((m) => (
            <li key={m.id} className="rounded-card border border-line bg-surface px-4 py-3 flex flex-col gap-2">
              <span className="flex items-center gap-3 flex-wrap">
                <span
                  className="shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-heading font-semibold text-white"
                  style={{ backgroundColor: BARVA_STAVU_MEDIA[m.stav] }}
                >
                  {t(`pr.stavMedia.${m.stav}`)}
                </span>
                <span className="font-heading font-semibold text-sm text-ink grow min-w-[160px]">
                  {m.nazev}
                  <span className="font-body font-normal text-muted"> · {t(`pr.druh.${m.druh}`)}</span>
                </span>
                <select
                  value={m.stav}
                  onChange={(e) => zmen(m.id, { stav: e.target.value as StavMedia })}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-heading text-ink"
                >
                  {STAVY_MEDIA.map((s) => (
                    <option key={s} value={s}>
                      {t(`pr.stavMedia.${s}`)}
                    </option>
                  ))}
                </select>
              </span>
              {(m.kontakt || m.odkaz) && (
                <span className="text-xs font-body text-muted break-words">
                  {m.kontakt}
                  {m.odkaz && (
                    <>
                      {m.kontakt ? ' · ' : ''}
                      <a href={m.odkaz} target="_blank" rel="noopener noreferrer" className="text-brand-purpleLight">
                        {t('pr.zdroj')}
                      </a>
                    </>
                  )}
                  {!m.overeno && <span className="text-status-progress"> · {t('pr.neovereno')}</span>}
                </span>
              )}
              {m.duvod && <span className="text-xs font-body text-ink">{m.duvod}</span>}
              {m.odeslanoAt && (
                <span className="text-[11px] font-body text-muted">
                  {t('pr.odeslano')} {formatDatumCas(jazyk, new Date(m.odeslanoAt))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-card border border-line bg-field p-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 grow min-w-[180px]">
          <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
            {t('pr.nazevMedia')}
          </span>
          <input value={nazev} onChange={(e) => setNazev(e.target.value)} className={POLE} />
        </label>
        <label className="flex flex-col gap-1 w-[150px]">
          <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
            {t('pr.druhMedia')}
          </span>
          <select
            value={druh}
            onChange={(e) => setDruh(e.target.value as DruhMedia)}
            className={POLE}
          >
            {DRUHY_MEDIA.map((d) => (
              <option key={d} value={d}>
                {t(`pr.druh.${d}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 grow min-w-[180px]">
          <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
            {t('pr.kontakt')}
          </span>
          <input value={kontakt} onChange={(e) => setKontakt(e.target.value)} className={POLE} />
        </label>
        <button
          type="button"
          onClick={pridej}
          disabled={!nazev.trim()}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent disabled:opacity-50"
        >
          {t('pr.pridatMedium')}
        </button>
      </div>
    </div>
  );
}

/** 0:07, 1:24 - kolik času už Ema na úkolu je. */
function cas(sekund: number): string {
  const m = Math.floor(sekund / 60);
  const s = sekund % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
