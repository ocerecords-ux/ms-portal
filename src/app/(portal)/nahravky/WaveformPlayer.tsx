'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Přehrávač s waveformou (zadani 5. 9. 2026: "chtělo by to spíše graficky
 * zobrazit waveformu"). Staví na wavesurfer.js, který se natahuje až v
 * prohlížeči (dynamický import) - na serveru by neprošel.
 *
 * Zvuk hraje pres bezny <audio> element, ktery wavesurferu predavame jako
 * "media". Kdyz se kresleni waveformy z jakehokoliv duvodu nepovede (velky
 * soubor, chyba dekodovani), zustane funkcni aspon prehravani.
 */
export function WaveformPlayer({ src, autoPlay }: { src: string; autoPlay?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [waveformFailed, setWaveformFailed] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col gap-2">
      {!waveformFailed && (
        <div className="relative">
          <div ref={containerRef} className="w-full" />
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted font-body">
              Načítám průběh nahrávky…
            </span>
          )}
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} controls autoPlay={autoPlay} preload="metadata" className="w-full h-9" />
    </div>
  );
}
