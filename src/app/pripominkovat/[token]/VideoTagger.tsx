'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PripominkaKVideu } from '@/lib/reklamaPripominky';

/**
 * AUDIOTAGGER PRO REKLAMY (zadání 18. 9. 2026: „po kliknutí se otevře
 * modifikovaný audiotagger pro reklamy, kde bude video v náhledu, pod ním
 * bude vykreslená zvuková stopa a napravo se budou taggovat připomínky").
 *
 * Rozložení je přesně to zadané: vlevo nahoře video, pod ním waveforma,
 * vpravo sloupec připomínek. Na telefonu se sloupec sroluje pod video - jinak
 * by na obojí nezbylo místo.
 *
 * JEDNY HODINY PRO VŠECHNO. Waveforma není druhý přehrávač: wavesurfer dostane
 * přímo ten `<video>` element jako médium, takže klik do vlny přetočí video,
 * kurzor jde s obrazem a připomínka se zapíše k času, který je zrovna vidět.
 *
 * Klient se nikam nepřihlašuje, takže jméno je obyčejné políčko. Pamatuje si
 * ho prohlížeč, ať ho nepíše u každé připomínky znovu.
 */

const KLIC_JMENA = 'ms-portal-pripominky-jmeno';

function cas(sekundy: number): string {
  if (!Number.isFinite(sekundy) || sekundy < 0) sekundy = 0;
  const m = Math.floor(sekundy / 60);
  const s = sekundy - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export function VideoTagger({
  token,
  fileId,
  nazev,
  projekt,
  pocatecni,
  jsemZTymu,
}: {
  token: string;
  fileId: string;
  nazev: string;
  projekt: string;
  pocatecni: PripominkaKVideu[];
  jsemZTymu: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const vlnaRef = useRef<HTMLDivElement | null>(null);
  const [pripominky, setPripominky] = useState<PripominkaKVideu[]>(pocatecni);
  const [text, setText] = useState('');
  const [jmeno, setJmeno] = useState('');
  const [znacka, setZnacka] = useState<number | null>(null);
  const [ted, setTed] = useState(0);
  const [posilam, setPosilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [vlnaSelhala, setVlnaSelhala] = useState(false);

  const src = `/api/drive/download?fileId=${encodeURIComponent(fileId)}&k=${encodeURIComponent(
    token,
  )}&disposition=inline`;

  useEffect(() => {
    try {
      const ulozene = window.localStorage.getItem(KLIC_JMENA);
      if (ulozene) setJmeno(ulozene);
    } catch {
      // Soukrome okno - jmeno se proste nepamatuje.
    }
  }, []);

  // Waveforma pod videem. Kdyz se nepovede (velky soubor, prohlizec neumi),
  // zustane funkcni video i zapisovani - vlna je pomucka, ne podminka.
  useEffect(() => {
    let zniceno = false;
    let instance: { destroy: () => void } | null = null;

    async function priprav() {
      if (!vlnaRef.current || !videoRef.current) return;
      try {
        const WaveSurfer = (await import('wavesurfer.js')).default;
        if (zniceno || !vlnaRef.current || !videoRef.current) return;
        const ws = WaveSurfer.create({
          container: vlnaRef.current,
          media: videoRef.current,
          height: 72,
          waveColor: '#C9BEF5',
          progressColor: '#7B55FF',
          cursorColor: '#1FDF67',
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
        });
        instance = ws;
        ws.on('error', () => !zniceno && setVlnaSelhala(true));
      } catch {
        if (!zniceno) setVlnaSelhala(true);
      }
    }

    void priprav();
    return () => {
      zniceno = true;
      try {
        instance?.destroy();
      } catch {
        // wavesurfer obcas hlasi chybu pri uklidu - nevadi
      }
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const naCas = () => setTed(video.currentTime);
    video.addEventListener('timeupdate', naCas);
    video.addEventListener('seeked', naCas);
    return () => {
      video.removeEventListener('timeupdate', naCas);
      video.removeEventListener('seeked', naCas);
    };
  }, []);

  const skoc = useCallback((sekundy: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, sekundy);
    setTed(video.currentTime);
  }, []);

  /**
   * Značku si člověk zapíchne dřív, než dopíše text - jinak by čas utekl,
   * než větu vymyslí. Tohle je přesně ten důvod, proč má AudioTagger
   * u audioknih tlačítko „Přidat chybu" a ne jen textové pole.
   */
  function zapichni() {
    const video = videoRef.current;
    video?.pause();
    setZnacka(video ? video.currentTime : ted);
  }

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    const obsah = text.trim();
    if (!obsah || posilam) return;
    setPosilam(true);
    setChyba(null);
    try {
      const res = await fetch('/api/reklama/pripominky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          k: token,
          soubor: fileId,
          cas: znacka ?? ted,
          text: obsah,
          autor: jmeno.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Připomínku se nepodařilo uložit.');
        return;
      }
      setPripominky((c) => [...c, data as PripominkaKVideu].sort((a, b) => a.cas - b.cas));
      setText('');
      setZnacka(null);
      try {
        if (jmeno.trim()) window.localStorage.setItem(KLIC_JMENA, jmeno.trim());
      } catch {
        // nevadi
      }
    } catch {
      setChyba('Připomínku se nepodařilo uložit.');
    } finally {
      setPosilam(false);
    }
  }

  async function smaz(id: string) {
    setPripominky((c) => c.filter((p) => p.id !== id));
    try {
      const res = await fetch(
        `/api/reklama/pripominky/${id}?k=${encodeURIComponent(token)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Smazání se nezdařilo.');
        await nactiZnovu();
      }
    } catch {
      await nactiZnovu();
    }
  }

  async function odskrtni(p: PripominkaKVideu) {
    setPripominky((c) => c.map((x) => (x.id === p.id ? { ...x, vyrizeno: !x.vyrizeno } : x)));
    try {
      await fetch(`/api/reklama/pripominky/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vyrizeno: !p.vyrizeno }),
      });
    } catch {
      await nactiZnovu();
    }
  }

  const nactiZnovu = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reklama/pripominky?k=${encodeURIComponent(token)}&soubor=${encodeURIComponent(fileId)}`,
        { cache: 'no-store' },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPripominky(data.pripominky ?? []);
    } catch {
      // nevadi - seznam zustane, jaky je
    }
  }, [token, fileId]);

  const otevrene = pripominky.filter((p) => !p.vyrizeno).length;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
        <div className="bg-black rounded-card overflow-hidden border border-line">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={src}
            controls
            preload="metadata"
            playsInline
            className="w-full max-h-[60vh] bg-black"
          />
        </div>

        <div className="bg-surface rounded-card border border-line shadow-sm p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-heading font-semibold text-[11px] uppercase tracking-[0.12em] text-muted">
              Zvuková stopa
            </span>
            <span className="font-heading text-sm text-ink tabular-nums">{cas(ted)}</span>
          </div>
          <div ref={vlnaRef} className={vlnaSelhala ? 'hidden' : ''} />
          {vlnaSelhala && (
            <p className="text-xs font-body text-muted m-0">
              Křivku se u tohohle souboru nepodařilo vykreslit — připomínky můžete psát dál,
              čas se bere z přehrávače.
            </p>
          )}
          <button
            type="button"
            onClick={zapichni}
            className="self-start bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors"
          >
            Označit místo ({cas(znacka ?? ted)})
          </button>
        </div>
      </div>

      <aside className="w-full lg:w-[380px] shrink-0 flex flex-col gap-3">
        <form
          onSubmit={odesli}
          className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-heading font-semibold text-sm text-ink m-0">Nová připomínka</h2>
            <span className="font-heading text-sm text-brand-purple tabular-nums">
              {cas(znacka ?? ted)}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Co je potřeba upravit?"
            className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-brand-purple"
          />
          <input
            value={jmeno}
            onChange={(e) => setJmeno(e.target.value)}
            placeholder="Vaše jméno (nepovinné)"
            className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-brand-purple"
          />
          {chyba && <p className="text-xs font-body text-danger m-0">{chyba}</p>}
          <button
            type="submit"
            disabled={posilam || !text.trim()}
            className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {posilam ? 'Ukládám…' : 'Přidat připomínku'}
          </button>
          <p className="text-xs font-body text-muted m-0">
            Připomínka se uloží k času {cas(znacka ?? ted)} ve videu {nazev}. Vidíme ji hned.
          </p>
        </form>

        <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-baseline justify-between gap-2">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Připomínky
            </h2>
            <span className="text-xs font-body text-muted">
              {pripominky.length === 0 ? 'zatím žádné' : `${otevrene} z ${pripominky.length} otevřených`}
            </span>
          </div>
          <div className="max-h-[52vh] overflow-y-auto divide-y divide-line">
            {pripominky.length === 0 && (
              <p className="text-sm font-body text-muted m-0 px-4 py-6 text-center">
                Pusťte si spot a v místě, kde něco drhne, dejte „Označit místo".
              </p>
            )}
            {pripominky.map((p) => (
              <div key={p.id} className={`px-4 py-3 flex gap-3 ${p.vyrizeno ? 'opacity-60' : ''}`}>
                <button
                  type="button"
                  onClick={() => skoc(p.cas)}
                  title="Přehrát od tohohle místa"
                  className="shrink-0 font-heading font-semibold text-xs text-brand-purple tabular-nums pt-0.5"
                >
                  {cas(p.cas)}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-body text-ink m-0 break-words ${p.vyrizeno ? 'line-through' : ''}`}>
                    {p.text}
                  </p>
                  <span className="block text-[11px] font-body text-muted mt-0.5">
                    {p.autorJmeno || 'Bez jména'} ·{' '}
                    {new Intl.DateTimeFormat('cs-CZ', {
                      day: 'numeric',
                      month: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(p.createdAt))}
                  </span>
                </div>
                <span className="shrink-0 flex flex-col items-end gap-1">
                  {jsemZTymu && (
                    <button
                      type="button"
                      onClick={() => void odskrtni(p)}
                      title={p.vyrizeno ? 'Vrátit mezi otevřené' : 'Označit jako vyřízené'}
                      className="text-[11px] font-heading font-semibold text-muted hover:text-brand-purple"
                    >
                      {p.vyrizeno ? 'Vrátit' : 'Hotovo'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void smaz(p.id)}
                    title="Smazat připomínku"
                    className="text-[11px] font-heading text-muted hover:text-danger"
                  >
                    Smazat
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs font-body text-muted m-0 px-1">
          Projekt {projekt}. Odkaz si můžete přeposlat komukoliv z týmu — přihlašovat se nikam
          nemusí.
        </p>
      </aside>
    </div>
  );
}
