'use client';

import { useEffect, useRef, useState } from 'react';

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

export function WaveformPlayer({ src, autoPlay }: { src: string; autoPlay?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [waveformFailed, setWaveformFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
          cursorColor: '#201A33',
          cursorWidth: 1,
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

  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1">
      <button
        type="button"
        onClick={toggle}
        title={playing ? 'Pozastavit' : 'Přehrát'}
        aria-label={playing ? 'Pozastavit' : 'Přehrát'}
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
          <div className="relative">
            <div ref={containerRef} className="w-full" />
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-muted font-body">
                Načítám průběh nahrávky…
              </span>
            )}
          </div>
        )}
      </div>

      <span className="text-xs font-heading text-muted tabular-nums w-12 shrink-0">
        −{formatTime(remaining)}
      </span>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} autoPlay={autoPlay} preload="metadata" className="hidden" />
    </div>
  );
}
