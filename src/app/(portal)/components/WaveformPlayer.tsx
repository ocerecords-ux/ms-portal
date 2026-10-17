'use client';

import { useEffect, useRef, useState } from 'react';
import { usePreklad } from './JazykProvider';

/**
 * Přehrávač s waveformou (zadani 5. 9. 2026: "chtělo by to spíše graficky
 * zobrazit waveformu").
 *
 * Od 9. 9. 2026 ho pouzivaji dve mista - Nahravky a prilohy v MS chatu
 * ("slo by tu prilohu prehrat, kdyz je to zvuk, jako to mame v Nahravkach") -
 * proto sedi mezi spolecnymi komponentami, ne u Nahravek. Staví na wavesurfer.js, který se natahuje až v
 * prohlížeči (dynamický import) - na serveru by neprošel.
 *
 * Ovládání je celé vlastní, v barvách portálu - černá systémová lišta
 * prohlížeče (<audio controls>) uz tu neni (zadani 5. 9. 2026: "ten černý
 * pruh je hnusný"). Zvuk hraje pres skryty <audio> element, ktery wavesurferu
 * predavame jako "media", takze klik do waveformy prehravani previne. Kdyz se
 * kresleni waveformy nepovede (velky soubor, chyba dekodovani), zustane
 * funkcni prehravani i vlastni ukazatel prubehu.
 */

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M7 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

export type UsekSkladby = { od: number; do: number };

export function WaveformPlayer({
  src,
  autoPlay,
  usek = null,
  naUsek,
}: {
  src: string;
  autoPlay?: boolean;
  /**
   * OZNAČENÁ ČÁST NAHRÁVKY (zadání 17. 10. 2026: „ještě by se mi líbilo,
   * kdybych mohl označit ve stopě nějak, kterou část nahrávky použít").
   * Vteřiny od začátku skladby; prázdné = použije se celá.
   */
  usek?: UsekSkladby | null;
  /** Když je vyplněné, jde úsek křivkou označit. Jinak se jen přehrává. */
  naUsek?: (u: UsekSkladby | null) => void;
}) {
  const t = usePreklad();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const krivkaRef = useRef<HTMLDivElement | null>(null);
  const [waveformFailed, setWaveformFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  /** Rozdělaný výběr během tažení - uloží se až po puštění myši. */
  const [tazeny, setTazeny] = useState<UsekSkladby | null>(null);
  /** Zapnutý režim označování (tlačítkem) - viz komentář u obsluhy níž. */
  const [znacim, setZnacim] = useState(false);
  const zacatekTazeni = useRef<{ x: number; cas: number } | null>(null);
  const delkaRef = useRef(0);

  useEffect(() => {
    let destroyed = false;
    let instance: { destroy: () => void } | null = null;

    async function setup() {
      if (!containerRef.current || !audioRef.current) return;
      try {
        const WaveSurfer = (await import('wavesurfer.js')).default;
        if (destroyed || !containerRef.current || !audioRef.current) return;
        const ws = WaveSurfer.create({
          container: containerRef.current,
          media: audioRef.current,
          height: 56,
          waveColor: '#C9BEF5',
          progressColor: '#7B55FF',
          // Kurzor je vsude nase zelena (zadani 12. 9. 2026) - at je jasne,
          // kde clovek je, at se diva do prehravace kdekoliv.
          cursorColor: '#1FDF67',
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
        });
        instance = ws;
        ws.on('ready', () => !destroyed && setLoading(false));
        ws.on('error', () => {
          if (destroyed) return;
          setWaveformFailed(true);
          setLoading(false);
        });
      } catch {
        if (!destroyed) {
          setWaveformFailed(true);
          setLoading(false);
        }
      }
    }

    setup();
    return () => {
      destroyed = true;
      try {
        instance?.destroy();
      } catch {
        // wavesurfer obcas hlasi chybu pri uklidu rozdelaneho nacitani - nevadi
      }
    };
  }, [src]);

  // Stav prehravani si drzime z <audio> - je jedno, jestli prehravani spustil
  // nas knoflik nebo klik do waveformy.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }

  /** Náhradní ukazatel průběhu, když se waveforma nevykreslí. */
  function seekFromBar(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  /**
   * OZNAČENÍ ÚSEKU SE ZAPÍNÁ TLAČÍTKEM (oprava 17. 10. 2026: „to označování
   * tracku nefunguje. Zkusme tam dát nějaké tlačítko a tím se změní mód pro
   * označení").
   *
   * Do té doby si jedna vrstva nad křivkou brala obojí - krátké klepnutí
   * přesouvalo přehrávání, tažení označovalo úsek - a rozeznat jedno od
   * druhého se ukázalo jako nespolehlivé. Teď je to jednoznačné: dokud se
   * označování nezapne, křivka funguje jako dřív a vrstva tam vůbec není.
   *
   * Tažení hlídá DOKUMENT, ne ta vrstva: jakmile myš vyjede z křivky ven
   * (a u krátkého úseku to je snadné), element už o ní nic neví a výběr by se
   * zasekl na půl cesty.
   */
  const delka = duration;
  delkaRef.current = delka;

  function casZBodu(clientX: number): number {
    const prvek = krivkaRef.current;
    if (!prvek) return 0;
    const r = prvek.getBoundingClientRect();
    const pomer = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
    return pomer * delkaRef.current;
  }

  /**
   * Tažení hlídá DOKUMENT, ne ta vrstva: jakmile myš vyjede z křivky ven
   * (a u krátkého úseku to je snadné), element už o ní nic neví a výběr by se
   * zasekl na půl cesty. `pointer` události pokrývají myš i dotyk naráz.
   */
  function tahniOd(
    start: { cas: number },
    spocti: (cas: number) => UsekSkladby,
    poSkonceni?: () => void,
  ) {
    const pohyb = (ev: PointerEvent) => setTazeny(spocti(casZBodu(ev.clientX)));
    const konec = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', pohyb);
      document.removeEventListener('pointerup', konec);
      document.removeEventListener('pointercancel', konec);
      zacatekTazeni.current = null;
      setTazeny(null);
      poSkonceni?.();

      const vysledek = spocti(casZBodu(ev.clientX));
      const od = Math.round(vysledek.od);
      const doKdy = Math.round(vysledek.do);
      // Úsek kratší než vteřina je skoro jistě omyl.
      if (naUsek) naUsek(doKdy - od >= 1 ? { od, do: doKdy } : null);
    };
    zacatekTazeni.current = { x: 0, cas: start.cas };
    document.addEventListener('pointermove', pohyb);
    document.addEventListener('pointerup', konec);
    document.addEventListener('pointercancel', konec);
  }

  function zacniZnaceni(e: React.PointerEvent<HTMLDivElement>) {
    if (!naUsek || delkaRef.current <= 0) return;
    e.preventDefault();
    const zacatek = casZBodu(e.clientX);
    setTazeny({ od: zacatek, do: zacatek });
    tahniOd(
      { cas: zacatek },
      (cas) => ({ od: Math.min(zacatek, cas), do: Math.max(zacatek, cas) }),
      () => setZnacim(false),
    );
  }

  /** Dotažení hotového výběru za jeho kraj - jako v každém střihovém programu. */
  function posunKraj(e: React.PointerEvent<HTMLSpanElement>, kraj: 'od' | 'do') {
    if (!naUsek || !usek || delkaRef.current <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pevny = kraj === 'od' ? usek.do : usek.od;
    setTazeny(usek);
    tahniOd({ cas: pevny }, (cas) => ({
      od: Math.min(pevny, cas),
      do: Math.max(pevny, cas),
    }));
  }

  const vyber = tazeny ?? usek;
  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1">
      <button
        type="button"
        onClick={toggle}
        title={playing ? t('prehravac.pozastavit') : t('prehravac.prehrat')}
        aria-label={playing ? t('prehravac.pozastavit') : t('prehravac.prehrat')}
        className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-brand-green text-onAccent hover:brightness-95 transition-[filter]"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <span className="text-xs font-heading text-muted tabular-nums w-10 text-right shrink-0">
        {formatTime(currentTime)}
      </span>

      <div className="flex-1 min-w-0">
        {waveformFailed ? (
          <div
            onClick={seekFromBar}
            role="presentation"
            className="h-2 rounded-full bg-line overflow-hidden cursor-pointer"
          >
            <div className="h-full bg-brand-purple" style={{ width: `${progress}%` }} />
          </div>
        ) : (
          /* VÝŠKA JE ZADANÁ NAPEVNO (oprava 17. 10. 2026: „to označení úseku
             ještě nefunguje dobře"). Křivku si do sebe vykresluje wavesurfer
             a obal se podle ní sám neroztáhl, takže vrstva na označování měla
             nulovou výšku - myš do ní nemohla trefit a tažení se nikdy
             nezačalo. 56 px je výška, se kterou se křivka zakládá. */
          <div className="relative h-14" ref={krivkaRef}>
            <div ref={containerRef} className="w-full h-full" />
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-muted font-body">
                {t('prehravac.nacitamPrubeh')}
              </span>
            )}

            {/* OZNAČENÝ ÚSEK JAKO ZVÝRAZŇOVAČ (zadání 17. 10. 2026: „něco jako
                selektor pro výběr, jak v Cubase. Něco jako když označíš
                zvýrazňovačem"). Pruh přes celou výšku křivky, po krajích
                úchyty, kterými se dá výběr dotáhnout. */}
            {naUsek && duration > 0 && vyber && (
              <div
                className="absolute inset-y-0 bg-brand-green/25 border-x-2 border-brand-green"
                style={{
                  left: `${(vyber.od / duration) * 100}%`,
                  width: `${Math.max(0.5, ((vyber.do - vyber.od) / duration) * 100)}%`,
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                {!znacim && (
                  <>
                    <span
                      role="presentation"
                      onPointerDown={(e) => posunKraj(e, 'od')}
                      title={t('prehravac.posunoutZacatek')}
                      className="absolute inset-y-0 -left-2 w-4 cursor-ew-resize"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <span className="absolute inset-y-1 left-1.5 w-1 rounded-full bg-brand-green" />
                    </span>
                    <span
                      role="presentation"
                      onPointerDown={(e) => posunKraj(e, 'do')}
                      title={t('prehravac.posunoutKonec')}
                      className="absolute inset-y-0 -right-2 w-4 cursor-ew-resize"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <span className="absolute inset-y-1 right-1.5 w-1 rounded-full bg-brand-green" />
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Vrstva na označování. Je tu POŘÁD, jen propouští myš dál, dokud
                se označování nezapne - tak si nemůže nic stoupnout nad ni. */}
            {naUsek && (
              <div
                role="presentation"
                onPointerDown={zacniZnaceni}
                className={`absolute -inset-y-1 inset-x-0 rounded-md transition-colors ${
                  znacim ? 'cursor-crosshair bg-brand-green/10 ring-1 ring-brand-green/60' : ''
                }`}
                style={{ zIndex: 30, pointerEvents: znacim ? 'auto' : 'none' }}
              />
            )}
          </div>
        )}
      </div>

      <span className="text-xs font-heading text-muted tabular-nums w-12 shrink-0">
        −{formatTime(remaining)}
      </span>

      {naUsek && (
        <button
          type="button"
          onClick={() => setZnacim((z) => !z)}
          title={t('prehravac.oznacitUsekPopis')}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-heading font-semibold cursor-pointer transition-colors ${
            znacim
              ? 'border-0 bg-brand-green text-onAccent'
              : 'border border-line bg-transparent text-muted hover:text-ink hover:border-brand-purpleLight'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="w-3.5 h-3.5"
            aria-hidden="true"
          >
            <path d="M7 5v14" />
            <path d="M17 5v14" />
            <path d="M7 12h10" />
          </svg>
          {znacim ? t('prehravac.tahneteProUsek') : t('prehravac.oznacitUsek')}
        </button>
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} autoPlay={autoPlay} preload="metadata" className="hidden" />
    </div>
  );
}
