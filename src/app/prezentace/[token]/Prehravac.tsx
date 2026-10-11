'use client';

import { useEffect, useRef, useState } from 'react';
import { delkaSlovy, jeVideo, odkazNaUkazku, type UkazkaData } from '@/lib/prezentaceNabidky';
import { prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * PŘEHRÁVAČ UKÁZKY V PREZENTACI (zadání 11. 10. 2026: „tady bych dal MP3
 * ukázky do nějakého přehrávače").
 *
 * VLASTNÍ, NE SYSTÉMOVÝ. Černý pruh `<audio controls>` vypadá v obrandované
 * nabídce jako cizí těleso; tohle je v barvách portálu a na mobilu se do něj
 * dá trefit palcem.
 *
 * ZVUKOVÁ KŘIVKA SE KRESLÍ, KDYŽ TO JDE. Wavesurfer se natahuje až
 * v prohlížeči a soubor si stáhne `fetch`em - proto bajty jdou přes portál,
 * ne z podepsané adresy úložiště, kam by skript kvůli chybějícím hlavičkám
 * CORS nedosáhl. Když se kreslení nepovede, zůstane obyčejný pruh postupu
 * a hraje se dál; rozbitá křivka nesmí sebrat poslech.
 *
 * HRAJE VŽDY JEN JEDNA UKÁZKA. Dvě dema přes sebe nejde posoudit, takže
 * spuštění jedné zastaví ostatní - zařizuje to `onHraje` v rodiči.
 */
export function Prehravac({
  ukazka,
  jazyk,
  hraje,
  onHraje,
}: {
  ukazka: UkazkaData;
  /** Veřejná stránka stojí mimo JazykProvider - jazyk chodí propem. */
  jazyk: Jazyk;
  hraje: boolean;
  onHraje: () => void;
}) {
  const zvuk = useRef<HTMLAudioElement | null>(null);
  const kresba = useRef<HTMLDivElement | null>(null);
  const [bezi, setBezi] = useState(false);
  const [kde, setKde] = useState(0);
  const [delka, setDelka] = useState(ukazka.delka || 0);
  const [bezKrivky, setBezKrivky] = useState(false);

  /** Když se rozjede jiná ukázka, tahle se zastaví. */
  useEffect(() => {
    if (!hraje && bezi) zvuk.current?.pause();
  }, [bezi, hraje]);

  useEffect(() => {
    let zahozeno = false;
    let instance: { destroy: () => void } | null = null;

    async function priprav() {
      if (!kresba.current || !zvuk.current) return;
      try {
        const WaveSurfer = (await import('wavesurfer.js')).default;
        if (zahozeno || !kresba.current || !zvuk.current) return;
        const ws = WaveSurfer.create({
          container: kresba.current,
          media: zvuk.current,
          height: 48,
          waveColor: 'rgba(123, 85, 255, 0.35)',
          progressColor: '#1FDF67',
          cursorColor: 'transparent',
          barWidth: 2,
          barGap: 2,
          barRadius: 2,
          normalize: true,
        });
        instance = ws;
        ws.on('error', () => setBezKrivky(true));
      } catch (err) {
        console.error('Křivku se nepodařilo vykreslit:', err);
        setBezKrivky(true);
      }
    }

    void priprav();
    return () => {
      zahozeno = true;
      try {
        instance?.destroy();
      } catch {
        /* Zahozená instance už nikoho nezajímá. */
      }
    };
  }, []);

  function prepni() {
    const a = zvuk.current;
    if (!a) return;
    if (a.paused) {
      onHraje();
      void a.play().catch(() => null);
    } else {
      a.pause();
    }
  }

  if (jeVideo(ukazka.typSouboru)) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <p className="font-heading font-semibold text-ink text-base m-0">{ukazka.nazev}</p>
          {ukazka.popis && <p className="font-body text-sm text-muted m-0 mt-0.5">{ukazka.popis}</p>}
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={odkazNaUkazku(ukazka.id)}
          controls
          preload="metadata"
          onPlay={onHraje}
          className="w-full rounded-card bg-black"
        />
      </div>
    );
  }

  const podil = delka > 0 ? Math.min(100, (kde / delka) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={prepni}
          aria-label={
            bezi ? prelozit(jazyk, 'prezentaceKlient.zastavit') : prelozit(jazyk, 'prezentaceKlient.prehrat')
          }
          className="shrink-0 w-11 h-11 rounded-full bg-brand-green text-black border-0 cursor-pointer flex items-center justify-center transition-transform hover:scale-105"
        >
          {bezi ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
              <path d="M7 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-semibold text-ink text-base m-0">{ukazka.nazev}</p>
          {ukazka.popis && <p className="font-body text-sm text-muted m-0 mt-0.5">{ukazka.popis}</p>}
        </div>
        <span className="shrink-0 font-body text-xs text-muted tabular-nums mt-1">
          {delkaSlovy(kde > 0 ? kde : delka)}
        </span>
      </div>

      {/* Křivka; než se vykreslí (nebo když se nepovede), je tu pruh postupu. */}
      <div className="relative">
        <div ref={kresba} className={bezKrivky ? 'hidden' : 'cursor-pointer'} />
        {bezKrivky && (
          <div className="h-1.5 rounded-pill bg-brand-purple/20 overflow-hidden">
            <div className="h-full bg-brand-green transition-[width]" style={{ width: `${podil}%` }} />
          </div>
        )}
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={zvuk}
        src={odkazNaUkazku(ukazka.id)}
        preload="metadata"
        onPlay={() => setBezi(true)}
        onPause={() => setBezi(false)}
        onEnded={() => setBezi(false)}
        onTimeUpdate={(e) => setKde(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDelka(d);
        }}
        className="hidden"
      />
    </div>
  );
}
