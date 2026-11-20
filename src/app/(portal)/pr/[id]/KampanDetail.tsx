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
import { zkontrolujSpam } from '@/lib/prSpam';

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
  /**
   * PŘEDLOHA MAILU DRŽÍ RODIČ (oprava 20. 11. 2026: „a je pořád blbá. Lže.
   * Je tam pořád zvuková").
   *
   * Ema předlohu opravdu přepsala - jenže panel si text načetl jednou při
   * otevření stránky a pak už se neměnil, takže na obrazovce zůstalo staré
   * znění a vypadalo to, že lže. Teď se po každém jejím úkolu načte znovu.
   */
  const [zalozka, setZalozka] = useState<Zalozka>('prubeh');
  const [filtr, setFiltr] = useState<FiltrMedii>('vse');
  const [predloha, setPredloha] = useState({
    predmet: kampan.predmetMailu ?? '',
    text: kampan.textMailu ?? '',
    pokyny: kampan.pokyny ?? '',
  });
  const [zadani, setZadani] = useState('');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [briefOtevreny, setBriefOtevreny] = useState(false);
  /** Vlákno rozhovoru - po každé nové zprávě sjede dolů, jako chat. */
  const vlakno = useRef<HTMLDivElement | null>(null);
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
        void nactiPredlohu();
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

  const nactiPredlohu = useCallback(async () => {
    const res = await fetch(`/api/pr/kampane/${encodeURIComponent(kampan.id)}/mail`).catch(
      () => null,
    );
    if (!res?.ok) return;
    const data = (await res.json()) as { predmet?: string; text?: string; pokyny?: string };
    setPredloha({
      predmet: data.predmet ?? '',
      text: data.text ?? '',
      pokyny: data.pokyny ?? '',
    });
  }, [kampan.id]);

  const nactiMedia = useCallback(async () => {
    const res = await fetch(`/api/pr/kampane/${encodeURIComponent(kampan.id)}/media`).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { media: Medium[] };
    setMedia(data.media);
  }, [kampan.id]);

  /** Co má člověk zrovna otevřené - jde to Emě s každým zadáním. */
  function kontextProEmu(): string {
    const nazvy: Record<Zalozka, string> = {
      prubeh: t('pr.zalozka.prubeh'),
      media: t('pr.zalozka.media'),
      fronta: t('pr.zalozka.fronta'),
      nastaveni: t('pr.zalozka.nastaveni'),
    };
    const casti = [`otevřená záložka ${nazvy[zalozka]}`];
    if (zalozka === 'media' && filtr !== 'vse') casti.push(`filtr ${filtr}`);
    return casti.join(', ').slice(0, 500);
  }

  async function posliZadani(predvolba?: string) {
    const text = (predvolba ?? zadani).trim();
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
      moznosti: [],
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
      /**
       * POSÍLÁ SE I TO, NA CO SE DÍVÁ (20. 11. 2026: „chci s Emou mluvit jako
       * s normálním členem týmu"). Kolega u stolu vidí tvoji obrazovku - díky
       * tomu dává smysl „zkrať to" bez vysvětlování, co „to" je.
       */
      body: JSON.stringify({ zadani: text, kontext: kontextProEmu() }),
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
    void nactiPredlohu();
  }

  /**
   * ROZHOVOR SE ČTE SHORA DOLŮ (zadání 19. 11. 2026: „okno chatu musí být
   * výrazné a vlevo může být komunikace a vpravo ta pole"). Ze serveru chodí
   * úkoly od nejnovějšího, chat je ale opačně - nejstarší nahoře a vstup dole.
   */
  const vlaknoZprav = [...ukoly].reverse();
  useEffect(() => {
    const el = vlakno.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ukoly.length, ukolVPohybu?.kroky.length]);

  return (
    <div className="flex flex-col gap-5">
      {/* HLAVIČKA. Zadání kampaně se nerozpíná přes první obrazovku - je pod
          tlačítkem a vybalí se, když ho někdo potřebuje. */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-3xl text-ink m-0 grow min-w-0 truncate">{kampan.nazev}</h1>
        {kampan.brief && (
          <button
            type="button"
            onClick={() => setBriefOtevreny((p) => !p)}
            className="shrink-0 font-heading font-semibold text-xs rounded-pill px-3 py-1.5 border border-line bg-transparent text-muted hover:text-ink cursor-pointer transition-colors"
          >
            {briefOtevreny ? t('pr.briefSkryt') : t('pr.briefUkazat')}
          </button>
        )}
      </div>
      {kampan.brief && briefOtevreny && (
        <p className="text-sm font-body text-muted m-0 whitespace-pre-wrap rounded-card border border-line bg-surface px-4 py-3">
          {kampan.brief}
        </p>
      )}

      {/* STAVOVÝ PÁS: na jeden pohled, jak kampaň stojí. Každé číslo je
          zároveň filtr seznamu médií. */}
      <StavovyPas
        jazyk={jazyk}
        media={media}
        filtr={filtr}
        onFiltr={(f) => {
          setFiltr(f);
          setZalozka('media');
        }}
      />

      <div className="grid gap-5 items-start lg:grid-cols-[minmax(0,3fr)_minmax(330px,2fr)]">
        {/* VLEVO: ROZHOVOR S EMOU */}
        <section className="rounded-card border-2 border-brand-purple bg-field flex flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line bg-surface">
            <span className="relative shrink-0 grid place-items-center">
              {ukolVPohybu && (
                <span className="absolute inset-0 rounded-full border-2 border-brand-purple animate-ping" />
              )}
              <span className="relative w-9 h-9 rounded-full grid place-items-center bg-brand-purple text-white font-heading font-bold text-sm">
                EP
              </span>
            </span>
            <span className="flex flex-col min-w-0 grow">
              <span className="flex items-center gap-1.5 font-heading font-semibold text-sm text-ink">
                {t('pr.ema')}
                {ukolVPohybu && <Tecky />}
              </span>
              <span className="text-[11px] font-body text-muted truncate">
                {ukolVPohybu ? `${posledniKrok} · ${cas(tikot)}` : t('pr.emaRole')}
              </span>
            </span>
          </div>

          <div
            ref={vlakno}
            className="flex flex-col gap-4 px-4 py-4 min-h-[260px] max-h-[58vh] overflow-y-auto"
          >
            {vlaknoZprav.length === 0 && (
              <p className="text-sm font-body text-muted m-0">{t('pr.zadneUkoly')}</p>
            )}
            {vlaknoZprav.map((u) => (
              <div key={u.id} className="flex flex-col gap-2">
                {/* CO JSME CHTĚLI - bublina vpravo, jako v chatu. */}
                <div className="flex flex-col items-end gap-1">
                  <span className="max-w-[85%] rounded-card rounded-br-sm bg-tint px-3.5 py-2.5 text-sm font-body text-ink whitespace-pre-wrap">
                    {u.zadani}
                  </span>
                  <span className="text-[11px] font-body text-muted">
                    {u.zadalJmeno ?? t('pr.vy')} · {formatDatumCas(jazyk, new Date(u.createdAt))}
                  </span>
                </div>

                {/* CO NA TO EMA */}
                <div className="flex flex-col items-start gap-1">
                  {jeVPohybu(u.stav) && (
                    <ul className="list-none p-0 m-0 max-w-[85%] rounded-card rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 flex flex-col gap-1">
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
                            {posledni && <Tecky />}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {u.stav === 'CHYBA' && (
                    <span className="max-w-[85%] rounded-card rounded-bl-sm border border-line bg-dangerTint px-3.5 py-2.5 text-xs font-body text-danger">
                      {u.chyba ?? t('pr.emaNeslo')}
                    </span>
                  )}

                  {u.vystup && (
                    <>
                      <span className="max-w-[92%] rounded-card rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-sm font-body text-ink whitespace-pre-wrap">
                        {u.vystup}
                      </span>
                      {/* NABÍDKA K PROKLIKNUTÍ (20. 11. 2026: „chci, ať mi
                          nabízí možnosti, jako ty, na které jen kliknu
                          a nemusím to psát"). Jen u poslední odpovědi - starší
                          volby už neplatí. */}
                      {u.moznosti.length > 0 && u.id === ukoly[0]?.id && (
                        <span className="flex flex-wrap gap-2">
                          {u.moznosti.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => void posliZadani(m)}
                              disabled={bezi || Boolean(bezici)}
                              className="font-heading text-xs rounded-pill px-3 py-1.5 border border-brand-purple bg-tint text-brand-purpleDark cursor-pointer disabled:opacity-50 hover:bg-brand-purple hover:text-white transition-colors"
                            >
                              {m}
                            </button>
                          ))}
                        </span>
                      )}
                      <span className="text-[11px] font-body text-muted">
                        {t('pr.ema')}
                        {u.hotovoAt ? ` · ${formatDatumCas(jazyk, new Date(u.hotovoAt))}` : ''}
                        {u.hledani > 0 ? ` · ${t('pr.hledani', { pocet: u.hledani })}` : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* VSTUP DOLE, jako v každém chatu. */}
          <div className="border-t border-line bg-surface p-3 flex flex-col gap-2">
            <textarea
              value={zadani}
              onChange={(e) => setZadani(e.target.value)}
              /**
               * ENTER ODESÍLÁ (zadání 20. 11. 2026: „potřebuju, ať se to
               * odesílá rovnou entrem"). Je to chat, ne formulář - sahat po
               * myši mezi dvěma větami zdržuje. Nový řádek zůstává na
               * Shift+Enter a na Enter při rozepsaném českém psaní
               * (isComposing), aby se háčky nerozsekaly.
               */
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                void posliZadani();
              }}
              rows={3}
              placeholder={t('pr.zadaniPriklad')}
              className={`${POLE} resize-y`}
            />
            <span className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => void posliZadani()}
                disabled={bezi || !zadani.trim()}
                className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
              >
                {bezi ? t('pr.posilam') : t('pr.zadat')}
              </button>
              {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}
            </span>
          </div>
        </section>

        {/* VPRAVO: JEDNA VĚC CELÁ, NE TŘI PŮLKY (20. 11. 2026: „to prostředí
            a ovládání je celkově takové nejasné a nepřehledné"). */}
        <PravyPanel
          jazyk={jazyk}
          kampan={kampan}
          media={media}
          predloha={predloha}
          onPredloha={setPredloha}
          onMedia={setMedia}
          zalozka={zalozka}
          onZalozka={setZalozka}
          filtr={filtr}
          onFiltr={setFiltr}
        />
      </div>
    </div>
  );
}

export type Zalozka = 'prubeh' | 'media' | 'fronta' | 'nastaveni';
export type FiltrMedii = 'vse' | 'pripraveno' | 'fronta' | 'odeslano' | 'vyslo';

/** Je u média připravený mail, ale ještě neodešel ani nečeká ve frontě? */
function jePripraveno(m: Medium): boolean {
  return !m.odeslanoAt && !m.odeslatAt && Boolean(m.predmet?.trim() && m.textMailu?.trim());
}

/**
 * STAVOVÝ PÁS (zadání 20. 11. 2026: „to prostředí a ovládání je celkově
 * takové nejasné a nepřehledné").
 *
 * Kolik je médií, kolik jich má hotový mail, kolik čeká ve frontě, kolik
 * odešlo a kde to vyšlo - jedním pohledem, bez počítání řádků. Každé číslo
 * je zároveň filtr seznamu.
 */
function StavovyPas({
  jazyk,
  media,
  filtr,
  onFiltr,
}: {
  jazyk: Jazyk;
  media: Medium[];
  filtr: FiltrMedii;
  onFiltr: (f: FiltrMedii) => void;
}) {
  const t = (k: string) => prelozit(jazyk, k);
  /** Zelená je u toho, co je dotažené - odesláno a vyšlo. */
  const policka: { klic: FiltrMedii; popisek: string; pocet: number; zelene?: boolean }[] = [
    { klic: 'vse', popisek: t('pr.stav.media'), pocet: media.length },
    {
      klic: 'pripraveno',
      popisek: t('pr.stav.pripraveno'),
      pocet: media.filter(jePripraveno).length,
    },
    {
      klic: 'fronta',
      popisek: t('pr.stav.veFronte'),
      pocet: media.filter((m) => !m.odeslanoAt && m.odeslatAt).length,
    },
    {
      klic: 'odeslano',
      popisek: t('pr.stav.odeslano'),
      pocet: media.filter((m) => m.odeslanoAt).length,
      zelene: true,
    },
    {
      klic: 'vyslo',
      popisek: t('pr.stav.vyslo'),
      pocet: media.filter((m) => m.stav === 'VYSLO').length,
      zelene: true,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {policka.map((p) => {
        const aktivni = filtr === p.klic;
        return (
          <button
            key={p.klic}
            type="button"
            onClick={() => onFiltr(aktivni && p.klic !== 'vse' ? 'vse' : p.klic)}
            className={`rounded-card border px-3.5 py-2 text-left cursor-pointer transition-colors ${
              aktivni
                ? p.zelene
                  ? 'border-brand-green bg-okTint'
                  : 'border-brand-purple bg-tint'
                : 'border-line bg-surface hover:bg-field'
            }`}
          >
            <span
              className={`block font-display text-xl leading-none ${
                p.zelene && p.pocet > 0 ? 'text-status-done' : 'text-ink'
              }`}
            >
              {p.pocet}
            </span>
            <span className="block text-[11px] font-heading uppercase tracking-wide text-muted mt-1">
              {p.popisek}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * PRAVÝ PANEL SE ZÁLOŽKAMI. Dřív tu byly tři věci pod sebou v úzkém sloupci
 * a žádná nebyla vidět celá; teď je vidět vždycky jedna.
 */
function PravyPanel({
  jazyk,
  kampan,
  media,
  predloha,
  onPredloha,
  onMedia,
  zalozka,
  onZalozka,
  filtr,
  onFiltr,
}: {
  jazyk: Jazyk;
  kampan: Kampan;
  media: Medium[];
  predloha: Predloha;
  onPredloha: (p: Predloha) => void;
  onMedia: (m: Medium[]) => void;
  zalozka: Zalozka;
  onZalozka: (z: Zalozka) => void;
  filtr: FiltrMedii;
  onFiltr: (f: FiltrMedii) => void;
}) {
  const t = (k: string) => prelozit(jazyk, k);
  const veFronte = media.filter((m) => !m.odeslanoAt && m.odeslatAt).length;
  const zalozky: { klic: Zalozka; popisek: string; pocet?: number }[] = [
    { klic: 'prubeh', popisek: t('pr.zalozka.prubeh') },
    { klic: 'media', popisek: t('pr.zalozka.media'), pocet: media.length },
    { klic: 'fronta', popisek: t('pr.zalozka.fronta'), pocet: veFronte },
    { klic: 'nastaveni', popisek: t('pr.zalozka.nastaveni') },
  ];

  /**
   * ZÁLOŽKY STEJNÉ JAKO U PROJEKTU (zadání 20. 11. 2026: „pojďme to udělat
   * jako záložky, jak máme karty u projektu"). Tentýž tvar i chování jako
   * ProjectTabs - portál se nemá učit dvakrát.
   */
  return (
    <section className="flex flex-col gap-4">
      <nav className="flex items-center gap-1 flex-wrap border-b border-line">
        {zalozky.map((z) => {
          const aktivni = zalozka === z.klic;
          return (
            <button
              key={z.klic}
              type="button"
              onClick={() => onZalozka(z.klic)}
              aria-current={aktivni ? 'page' : undefined}
              className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                aktivni
                  ? 'bg-surface border-line text-brand-purple'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {z.popisek}
              {z.pocet ? <span className="ml-1.5 tabular-nums opacity-70">{z.pocet}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="rounded-card border border-line bg-surface p-4">
        {zalozka === 'prubeh' && <Prubeh jazyk={jazyk} media={media} />}
        {zalozka === 'media' && (
          <SeznamMedii
            jazyk={jazyk}
            kampanId={kampan.id}
            media={media}
            onZmena={onMedia}
            filtr={filtr}
            onFiltr={onFiltr}
          />
        )}
        {zalozka === 'fronta' && <Fronta jazyk={jazyk} media={media} onZmena={onMedia} kampanId={kampan.id} />}
        {zalozka === 'nastaveni' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                {t('pr.nastaveniMail')}
              </h3>
              <HromadnyMail
                jazyk={jazyk}
                kampan={kampan}
                predloha={predloha}
                onPredloha={onPredloha}
                onMedia={onMedia}
              />
            </div>
            <div className="flex flex-col gap-3 border-t border-line pt-5">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                {t('pr.nastaveniOsloveni')}
              </h3>
              <Pokyny jazyk={jazyk} kampanId={kampan.id} predloha={predloha} onPredloha={onPredloha} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * PRŮBĚH KAMPANĚ (zadání 20. 11. 2026: „a nějaké grafy s progresem").
 *
 * Tři pruhy, žádná knihovna: kolik médií má napsaný mail, kolika z nich už
 * jsme se ozvali a u kolika to vyšlo. Pod tím rozpad po stavech v barvách,
 * které má seznam médií - ať se nemusí luštit, co která barva znamená.
 */
function Prubeh({ jazyk, media }: { jazyk: Jazyk; media: Medium[] }) {
  const t = (k: string, h?: Record<string, string | number>) =>
    h ? prelozitS(jazyk, k, h) : prelozit(jazyk, k);
  const celkem = media.length;
  if (celkem === 0) {
    return <p className="text-sm font-body text-muted m-0">{t('pr.prubehPrazdno')}</p>;
  }

  const sMailem = media.filter((m) => m.predmet?.trim() && m.textMailu?.trim()).length;
  const osloveno = media.filter((m) => m.odeslanoAt).length;
  const vyslo = media.filter((m) => m.stav === 'VYSLO').length;

  const pruhy = [
    { popisek: t('pr.prubehMaily'), pocet: sMailem, barva: '#7B55FF' },
    { popisek: t('pr.prubehOsloveno'), pocet: osloveno, barva: '#6B2AF0' },
    { popisek: t('pr.stav.vyslo'), pocet: vyslo, barva: '#1FDF67' },
  ];

  const poStavech = STAVY_MEDIA.map((s) => ({
    stav: s,
    pocet: media.filter((m) => m.stav === s).length,
  })).filter((r) => r.pocet > 0);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-body text-muted m-0">{t('pr.prubehPopis')}</p>

      <div className="flex flex-col gap-3">
        {pruhy.map((p) => (
          <div key={p.popisek} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between text-xs font-heading text-ink">
              <span>{p.popisek}</span>
              <span className="tabular-nums text-muted">
                {p.pocet} / {celkem}
              </span>
            </span>
            <span className="block h-2.5 rounded-pill bg-field overflow-hidden">
              <span
                className="block h-full rounded-pill transition-all"
                style={{ width: `${Math.round((p.pocet / celkem) * 100)}%`, backgroundColor: p.barva }}
              />
            </span>
          </div>
        ))}
      </div>

      {/* ROZPAD PO STAVECH - jeden pruh, barvy jako u odznaků v seznamu. */}
      <div className="flex flex-col gap-2">
        <span className="flex h-3 rounded-pill overflow-hidden bg-field">
          {poStavech.map((r) => (
            <span
              key={r.stav}
              style={{
                width: `${(r.pocet / celkem) * 100}%`,
                backgroundColor: BARVA_STAVU_MEDIA[r.stav],
              }}
              title={`${t(`pr.stavMedia.${r.stav}`)}: ${r.pocet}`}
            />
          ))}
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {poStavech.map((r) => (
            <span key={r.stav} className="flex items-center gap-1.5 text-[11px] font-body text-muted">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: BARVA_STAVU_MEDIA[r.stav] }}
              />
              {t(`pr.stavMedia.${r.stav}`)} · {r.pocet}
            </span>
          ))}
        </span>
      </div>

      <p className="text-sm font-body text-ink m-0">
        {t('pr.prubehHotovo', { pocet: vyslo, celkem })}
      </p>
    </div>
  );
}

/**
 * FRONTA: co kdy odejde. Vlastní záložka proto, že „odesláno" a „odejde za
 * dvacet minut" jsou pro člověka dvě různé věci a v jednom seznamu se to
 * plete.
 */
function Fronta({
  jazyk,
  media,
  kampanId,
  onZmena,
}: {
  jazyk: Jazyk;
  media: Medium[];
  kampanId: string;
  onZmena: (m: Medium[]) => void;
}) {
  const t = (k: string, h?: Record<string, string | number>) =>
    h ? prelozitS(jazyk, k, h) : prelozit(jazyk, k);
  const cekaji = media
    .filter((m) => !m.odeslanoAt && m.odeslatAt)
    .sort((a, b) => (a.odeslatAt ?? '').localeCompare(b.odeslatAt ?? ''));

  async function zrus(id: string) {
    const res = await fetch(
      `/api/pr/kampane/${encodeURIComponent(kampanId)}/media/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odeslatAt: null }),
      },
    ).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { media: Medium[] };
    onZmena(data.media);
  }

  if (cekaji.length === 0) {
    return <p className="text-sm font-body text-muted m-0">{t('pr.frontaPrazdna')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-body text-muted m-0">{t('pr.veFrontePopis')}</p>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {cekaji.map((m) => (
          <li
            key={m.id}
            className="rounded-card border border-line bg-field px-3 py-2 flex items-center gap-2 flex-wrap"
          >
            <span className="font-heading font-semibold text-sm text-ink grow min-w-[120px]">
              {m.nazev}
            </span>
            <span className="text-xs font-body text-brand-purpleLight">
              {formatDatumCas(jazyk, new Date(m.odeslatAt as string))}
            </span>
            <button
              type="button"
              onClick={() => void zrus(m.id)}
              className="text-xs font-heading text-muted bg-transparent border-0 px-0 cursor-pointer hover:text-danger"
            >
              {t('pr.zrusitZFronty')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Trvalé pokyny ke kampani - co si Ema pamatuje a drží se toho. */
function Pokyny({
  jazyk,
  kampanId,
  predloha,
  onPredloha,
}: {
  jazyk: Jazyk;
  kampanId: string;
  predloha: Predloha;
  onPredloha: (p: Predloha) => void;
}) {
  const t = (k: string) => prelozit(jazyk, k);
  const [uklada, setUklada] = useState(false);
  const [ulozeno, setUlozeno] = useState(false);

  async function uloz() {
    setUklada(true);
    await fetch(`/api/pr/kampane/${encodeURIComponent(kampanId)}/mail`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        predmet: predloha.predmet,
        text: predloha.text,
        pokyny: predloha.pokyny,
      }),
    }).catch(() => null);
    setUklada(false);
    setUlozeno(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-body text-muted m-0">{t('pr.pokynyPopis')}</p>
      <textarea
        value={predloha.pokyny}
        onChange={(e) => {
          onPredloha({ ...predloha, pokyny: e.target.value });
          setUlozeno(false);
        }}
        rows={10}
        className={`${POLE} resize-y`}
      />
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={uklada}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-green text-onAccent border-0 cursor-pointer disabled:opacity-50"
        >
          {t('obecne.ulozit')}
        </button>
        {ulozeno && <span className="text-xs font-body text-status-done">{t('pr.mailUlozeno')}</span>}
      </span>
    </div>
  );
}

/** Tři skákající tečky - Ema právě pracuje. */
function Tecky() {
  return (
    <span className="flex items-end gap-0.5 pb-0.5" aria-hidden>
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="w-1 h-1 rounded-full bg-brand-purple animate-bounce"
          style={{ animationDelay: `${d * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/**
 * CO VEDE DO SPAMU (zadání 20. 11. 2026: „měla by vynechat i klíčová slova,
 * která vedou k tomu, že to skončí ve spamu").
 *
 * Nic neblokuje - jen řekne, čeho si filtry všimnou. Rozhodnout má člověk;
 * někdy je slovo v textu prostě na místě.
 */
function VarovaniSpam({ jazyk, predmet, text }: { jazyk: Jazyk; predmet: string; text: string }) {
  const nalezy = zkontrolujSpam(predmet, text);
  if (nalezy.length === 0) return null;
  return (
    <span className="text-xs font-body text-status-progress">
      {prelozitS(jazyk, 'pr.spamPozor', {
        slova: nalezy.map((n) => `${n.co} (${n.proc})`).join(', '),
      })}
    </span>
  );
}

/**
 * MAIL PRO CELOU KAMPAŇ (zadání 20. 11. 2026: „chci nastavovat mail hromadně
 * u každé kampaně").
 *
 * Jedna předloha pro všechna média - napíše se jednou a vloží se do mailů,
 * které ještě neodešly. {medium} se cestou nahradí názvem pořadu, ať to
 * nevypadá jako hromadný leták. Co už odešlo, se nemění.
 */
type Predloha = { predmet: string; text: string; pokyny: string };

function HromadnyMail({
  jazyk,
  kampan,
  predloha,
  onPredloha,
  onMedia,
}: {
  jazyk: Jazyk;
  kampan: Kampan;
  predloha: Predloha;
  onPredloha: (p: Predloha) => void;
  onMedia: (m: Medium[]) => void;
}) {
  const t = (k: string, h?: Record<string, string | number>) =>
    h ? prelozitS(jazyk, k, h) : prelozit(jazyk, k);
  const { predmet, text } = predloha;
  const setPredmet = (v: string) => onPredloha({ ...predloha, predmet: v });
  const setText = (v: string) => onPredloha({ ...predloha, text: v });
  const [jenPrazdna, setJenPrazdna] = useState(false);
  const [bezi, setBezi] = useState(false);
  const [pise, setPise] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);

  /**
   * NÁVRH OD EMY (20. 11. 2026: „a tady musí být návrh toho mailu, abych ho
   * jen upravil"). Text spadne do polí; uloží se, až se zmáčkne uložení -
   * prázdné pole není místo, kde začínat.
   */
  async function napisEmou() {
    setPise(true);
    setHlaska(null);
    const res = await fetch(`/api/pr/kampane/${encodeURIComponent(kampan.id)}/mail/navrh`, {
      method: 'POST',
    }).catch(() => null);
    setPise(false);
    if (!res?.ok) {
      setHlaska(t('pr.emaNeslo'));
      return;
    }
    const data = (await res.json().catch(() => null)) as
      | { predmet?: string; text?: string }
      | null;
    onPredloha({
      ...predloha,
      predmet: data?.predmet || predloha.predmet,
      text: data?.text || predloha.text,
    });
    setHlaska(t('pr.hromadnyMailOdEmyHotovo'));
  }

  async function uloz(vlozitDoMedii: boolean) {
    setBezi(true);
    setHlaska(null);
    const res = await fetch(`/api/pr/kampane/${encodeURIComponent(kampan.id)}/mail`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        predmet,
        text,
        pokyny: predloha.pokyny,
        vlozitDoMedii,
        jenPrazdna,
      }),
    }).catch(() => null);
    setBezi(false);
    const data = (await res?.json().catch(() => null)) as
      | { vlozeno?: number; media?: Medium[] }
      | null;
    if (!res?.ok) {
      setHlaska(t('pr.emaNeslo'));
      return;
    }
    if (data?.media) onMedia(data.media);
    setHlaska(
      vlozitDoMedii
        ? t('pr.hromadnyMailVlozeno', { pocet: data?.vlozeno ?? 0 })
        : t('pr.hromadnyMailUlozeno'),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-body text-muted m-0">{t('pr.hromadnyMailPopis')}</p>
      <button
        type="button"
        onClick={() => void napisEmou()}
        disabled={pise}
        className="self-start font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
      >
        {pise ? t('pr.hromadnyMailPiseEma') : t('pr.hromadnyMailOdEmy')}
      </button>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          {t('pr.predmetMailu')}
        </span>
        <input value={predmet} onChange={(e) => setPredmet(e.target.value)} className={POLE} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          {t('pr.textMailu')}
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className={`${POLE} resize-y`}
        />
      </label>
      <VarovaniSpam jazyk={jazyk} predmet={predmet} text={text} />

      <label className="flex items-center gap-2 text-xs font-body text-ink">
        <input
          type="checkbox"
          checked={jenPrazdna}
          onChange={(e) => setJenPrazdna(e.target.checked)}
        />
        {t('pr.hromadnyMailJenPrazdna')}
      </label>
      <span className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => void uloz(true)}
          disabled={bezi}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-green text-onAccent border-0 cursor-pointer disabled:opacity-50"
        >
          {t('pr.hromadnyMailVlozit')}
        </button>
        <button
          type="button"
          onClick={() => void uloz(false)}
          disabled={bezi}
          className="font-heading text-sm rounded-lg px-3 py-1.5 border border-line bg-transparent text-muted cursor-pointer disabled:opacity-50"
        >
          {t('pr.hromadnyMailUlozit')}
        </button>
        {hlaska && <span className="text-xs font-body text-status-done">{hlaska}</span>}
      </span>
    </section>
  );
}

function SeznamMedii({
  jazyk,
  kampanId,
  media,
  onZmena,
  filtr,
  onFiltr,
}: {
  jazyk: Jazyk;
  kampanId: string;
  media: Medium[];
  onZmena: (m: Medium[]) => void;
  filtr: FiltrMedii;
  onFiltr: (f: FiltrMedii) => void;
}) {
  const t = (k: string, h?: Record<string, string | number>) =>
    h ? prelozitS(jazyk, k, h) : prelozit(jazyk, k);
  const [nazev, setNazev] = useState('');
  const [druh, setDruh] = useState<DruhMedia>('PODCAST');
  const [kontakt, setKontakt] = useState('');
  const zaklad = `/api/pr/kampane/${encodeURIComponent(kampanId)}/media`;
  /**
   * MAIL U MÉDIA (zadání 20. 11. 2026). Předmět a text, co napsala Ema, se
   * dají přečíst i přepsat a teprve pak se mačká Odeslat. Portál sám nic
   * neposílá - odeslání je vždycky lidské kliknutí.
   */
  const [otevreny, setOtevreny] = useState<string | null>(null);
  const [potvrzuje, setPotvrzuje] = useState<string | null>(null);
  const [odesila, setOdesila] = useState<string | null>(null);
  const [chybaMailu, setChybaMailu] = useState<string | null>(null);
  /**
   * KONCEPT MAILU (zadání 20. 11. 2026: „dej mi někde možnost, abych mohl Emě
   * editovat ten mail, co posílá"). Co je v polích, drží obrazovka, ne
   * databáze - ukládá se tlačítkem a odeslání si uloží samo, ať nikdy neodejde
   * jiný text, než jaký je vidět.
   */
  const [koncept, setKoncept] = useState<{ predmet: string; text: string } | null>(null);
  const [uklada, setUklada] = useState(false);
  const [ulozeno, setUlozeno] = useState(false);
  const [nahled, setNahled] = useState<string | null>(null);
  const [nacitaNahled, setNacitaNahled] = useState(false);
  /**
   * HROMADNÉ ODESLÁNÍ (20. 11. 2026). Odkliknout dvacet médií po jednom je
   * práce navíc - fronta je stejně rozloží v čase, takže se vybere víc naráz
   * a pošle se jedním tlačítkem. Odesílá se po jednom za sebou, ať je vidět,
   * co se nepovedlo.
   */
  const [vybrana, setVybrana] = useState<string[]>([]);
  const [hromadne, setHromadne] = useState(false);

  const kOdeslani = media.filter(
    (m) => !m.odeslanoAt && !m.odeslatAt && m.predmet?.trim() && m.textMailu?.trim(),
  );

  async function odesliVybranym() {
    setHromadne(true);
    setChybaMailu(null);
    for (const id of vybrana) {
      await odesli(id);
    }
    setVybrana([]);
    setHromadne(false);
  }

  function otevri(m: Medium) {
    if (otevreny === m.id) {
      setOtevreny(null);
      setKoncept(null);
      setNahled(null);
      return;
    }
    setOtevreny(m.id);
    setKoncept({ predmet: m.predmet ?? '', text: m.textMailu ?? '' });
    setNahled(null);
    setUlozeno(false);
    setChybaMailu(null);
  }

  async function uloz(id: string) {
    if (!koncept) return;
    setUklada(true);
    await zmen(id, { predmet: koncept.predmet, textMailu: koncept.text });
    setUklada(false);
    setUlozeno(true);
  }

  async function ukazNahled() {
    if (nahled !== null) {
      setNahled(null);
      return;
    }
    setNacitaNahled(true);
    const res = await fetch('/api/pr/media/nahled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: koncept?.text ?? '' }),
    }).catch(() => null);
    setNacitaNahled(false);
    const data = (await res?.json().catch(() => null)) as { html?: string } | null;
    setNahled(data?.html ?? '');
  }

  async function odesli(id: string) {
    // Ať odejde přesně to, co je na obrazovce - i kdyby se zapomnělo uložit.
    await uloz(id);
    setOdesila(id);
    setChybaMailu(null);
    const res = await fetch('/api/pr/media/odeslat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kampanId, mediumId: id }),
    }).catch(() => null);
    setOdesila(null);
    setPotvrzuje(null);
    const data = (await res?.json().catch(() => null)) as
      | { media?: Medium[]; error?: string; hlaska?: string }
      | null;
    if (data?.media) onZmena(data.media);
    if (!res?.ok) {
      const zaklad = t(`pr.chyba.${data?.error ?? 'posta'}`);
      setChybaMailu(data?.hlaska ? `${zaklad} ${data.hlaska}` : zaklad);
    }
    else setOtevreny(null);
  }


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

  const videna = media.filter((m) => {
    if (filtr === 'pripraveno') return jePripraveno(m);
    if (filtr === 'fronta') return !m.odeslanoAt && m.odeslatAt;
    if (filtr === 'odeslano') return Boolean(m.odeslanoAt);
    if (filtr === 'vyslo') return m.stav === 'VYSLO';
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      {filtr !== 'vse' && (
        <button
          type="button"
          onClick={() => onFiltr('vse')}
          className="self-start text-xs font-heading text-brand-purpleLight bg-transparent border-0 px-0 cursor-pointer"
        >
          {t('pr.stav.media')} · {media.length}
        </button>
      )}
      <p className="text-xs font-body text-muted m-0">{t('pr.mediaPopis')}</p>

      {/* HROMADNÉ ODESLÁNÍ - fronta maily stejně rozloží v čase. */}
      {kOdeslani.length > 0 && (
        <span className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-body text-ink">
            <input
              type="checkbox"
              checked={vybrana.length > 0 && vybrana.length === kOdeslani.length}
              onChange={(e) => setVybrana(e.target.checked ? kOdeslani.map((m) => m.id) : [])}
            />
            {t('pr.vybratVse')}
          </label>
          {vybrana.length > 0 && (
            <button
              type="button"
              onClick={() => void odesliVybranym()}
              disabled={hromadne}
              className="font-heading font-semibold text-xs rounded-lg px-3 py-1.5 bg-brand-green text-onAccent border-0 cursor-pointer disabled:opacity-50"
            >
              {t('pr.vybranoOdeslat', { pocet: vybrana.length })}
            </button>
          )}
        </span>
      )}

      {videna.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {videna.map((m) => (
            /**
             * NÁZEV POŘADU JE NADPIS (zadání 20. 11. 2026: „ta média, která
             * najde, musí být jasné velké nadpisy, a pod tím doplňující info,
             * ať je to fakt výrazné"). Dřív to byl drobný tučný text v jednom
             * řádku s odznakem a rozbalovátkem - při deseti médiích se to
             * slilo v jednu šedou plochu.
             */
            <li key={m.id} className="rounded-card border border-line bg-surface px-4 py-4 flex flex-col gap-3">
              <span className="flex items-start gap-3">
                {!m.odeslanoAt && !m.odeslatAt && m.predmet?.trim() && m.textMailu?.trim() && (
                  <input
                    type="checkbox"
                    checked={vybrana.includes(m.id)}
                    onChange={(e) =>
                      setVybrana((p) =>
                        e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id),
                      )
                    }
                    className="shrink-0 mt-2"
                  />
                )}
                <span className="grow min-w-0 flex flex-col gap-1.5">
                  <span className="font-display text-xl sm:text-2xl text-ink leading-tight break-words">
                    {m.nazev}
                  </span>
                  <span className="flex items-center gap-2 flex-wrap">
                    <span
                      className="shrink-0 rounded-pill px-2.5 py-1 text-[10px] font-heading font-semibold uppercase tracking-wide text-white"
                      style={{ backgroundColor: BARVA_STAVU_MEDIA[m.stav] }}
                    >
                      {t(`pr.stavMedia.${m.stav}`)}
                    </span>
                    <span className="text-xs font-heading uppercase tracking-wide text-muted">
                      {t(`pr.druh.${m.druh}`)}
                    </span>
                  </span>
                </span>
                <select
                  value={m.stav}
                  onChange={(e) => zmen(m.id, { stav: e.target.value as StavMedia })}
                  className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-heading text-ink"
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
              {m.duvod && (
                <span className="text-sm font-body text-ink border-l-2 border-brand-green pl-3">
                  {m.duvod}
                </span>
              )}
              {m.odeslanoAt && (
                <span className="text-[11px] font-body text-muted">
                  {t('pr.odeslano')} {formatDatumCas(jazyk, new Date(m.odeslanoAt))}
                </span>
              )}
              {/* VE FRONTĚ (20. 11. 2026) - mail je odkliknutý, ale odejde
                  s odstupem, ať z nás pošta nemá rozesílku. */}
              {!m.odeslanoAt && m.odeslatAt && (
                <span className="text-[11px] font-body text-brand-purpleLight">
                  {t('pr.veFronte', { kdy: formatDatumCas(jazyk, new Date(m.odeslatAt)) })}
                </span>
              )}

              {/* MAIL - co napsala Ema, ke kontrole a k odeslání. */}
              <button
                type="button"
                onClick={() => otevri(m)}
                className="self-start text-xs font-heading text-brand-purpleLight bg-transparent border-0 px-0 cursor-pointer"
              >
                {otevreny === m.id
                  ? t('pr.mailSkryt')
                  : m.odeslanoAt
                    ? t('pr.mailUkazat')
                    : t('pr.mailUpravit')}
              </button>

              {otevreny === m.id && (
                <span className="flex flex-col gap-2 border-t border-line pt-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
                      {t('pr.predmetMailu')}
                    </span>
                    <input
                      value={koncept?.predmet ?? ''}
                      onChange={(e) => {
                        setKoncept((k) => ({ predmet: e.target.value, text: k?.text ?? '' }));
                        setUlozeno(false);
                      }}
                      className={POLE}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
                      {t('pr.textMailu')}
                    </span>
                    <textarea
                      value={koncept?.text ?? ''}
                      onChange={(e) => {
                        setKoncept((k) => ({ predmet: k?.predmet ?? '', text: e.target.value }));
                        setUlozeno(false);
                        setNahled(null);
                      }}
                      rows={14}
                      className={`${POLE} resize-y`}
                    />
                  </label>

                  <VarovaniSpam
                    jazyk={jazyk}
                    predmet={koncept?.predmet ?? ''}
                    text={koncept?.text ?? ''}
                  />
                  <span className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void uloz(m.id)}
                      disabled={uklada}
                      className="font-heading font-semibold text-sm rounded-lg px-3 py-1.5 border border-line bg-surface text-ink cursor-pointer disabled:opacity-50"
                    >
                      {t('pr.mailUlozit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void ukazNahled()}
                      disabled={nacitaNahled}
                      className="font-heading text-sm rounded-lg px-3 py-1.5 border border-line bg-transparent text-muted cursor-pointer disabled:opacity-50"
                    >
                      {nahled !== null ? t('pr.mailNahledSkryt') : t('pr.mailNahled')}
                    </button>
                    {ulozeno && <span className="text-xs font-body text-status-done">{t('pr.mailUlozeno')}</span>}
                  </span>

                  {nahled !== null && (
                    <span className="flex flex-col gap-1">
                      <span className="text-[11px] font-body text-muted">{t('pr.mailNahledPopis')}</span>
                      <span
                        className="rounded-card border border-line bg-white p-4 overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: nahled }}
                      />
                    </span>
                  )}

                  {!m.odeslanoAt && !m.odeslatAt && potvrzuje !== m.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setPotvrzuje(m.id);
                        setChybaMailu(null);
                      }}
                      className="self-start font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer"
                    >
                      {t('pr.odeslat')}
                    </button>
                  )}
                  {!m.odeslanoAt && !m.odeslatAt && potvrzuje === m.id && (
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-body text-ink">
                        {t('pr.opravduOdeslat', { adresa: m.kontakt ?? '' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => void odesli(m.id)}
                        disabled={odesila === m.id}
                        className="font-heading font-semibold text-sm rounded-lg px-3 py-1.5 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
                      >
                        {odesila === m.id ? t('pr.odesilam') : t('pr.odeslatAno')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPotvrzuje(null)}
                        className="font-heading text-sm rounded-lg px-3 py-1.5 border border-line bg-transparent text-muted cursor-pointer"
                      >
                        {t('obecne.zrusit')}
                      </button>
                    </span>
                  )}
                  {chybaMailu && potvrzuje === null && otevreny === m.id && (
                    <span className="text-xs font-body text-danger">{chybaMailu}</span>
                  )}
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
