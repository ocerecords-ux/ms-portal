'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { STROP_PRO_KRIVKU, spocitejKrivku, type Peaks } from '@/lib/krivkaZvuku';
import type { PripominkaKVideu } from '@/lib/reklamaPripominky';

/**
 * AUDIOTAGGER PRO REKLAMY (zadání 18. 9. 2026, upřesněné tentýž den:
 * „vlevo by měl být video náhled, pod tím se načíst zvlášť zvuková stopa,
 * poběží tam v naší grafice kurzor, tak jak je to v AudioTaggeru u knih,
 * a na pravé straně se budou zapisovat ty chyby, bez jména, a pak tam bude
 * jen tlačítko odeslat připomínky").
 *
 * KŘIVKA JE NAŠE, NE OD PŘEHRÁVAČE. Kreslí se do plátna přesně jako
 * u audioknih (viz Preposlech.tsx): přehraná část fialová, zbytek šedý,
 * zelený kurzor, červené značky v místech připomínek. Klik do křivky přetočí
 * video, klik na značku skočí na tu připomínku.
 *
 * ZAPSANÉ ≠ ODESLANÉ. Každá připomínka se uloží hned, aby se při zavření
 * okna nic neztratilo, ale dokud klient nezmáčkne „Odeslat připomínky", nikomu
 * u nás nic necinká. Teprve tlačítko říká „hotovo, kouknětě se na to".
 */

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
  velikost,
  pocatecni,
  jsemZTymu,
}: {
  token: string;
  fileId: string;
  nazev: string;
  /** Velikost souboru v bajtech - u obřích se křivka nepočítá. */
  velikost: number | null;
  pocatecni: PripominkaKVideu[];
  jsemZTymu: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pripominky, setPripominky] = useState<PripominkaKVideu[]>(pocatecni);
  const [text, setText] = useState('');
  const [znacka, setZnacka] = useState<number | null>(null);
  const [ted, setTed] = useState(0);
  const [delka, setDelka] = useState(0);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [krivkaStav, setKrivkaStav] = useState<'pocita' | 'hotovo' | 'nejde'>('pocita');
  const [posilam, setPosilam] = useState(false);
  const [odesilam, setOdesilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const src = `/api/drive/download?fileId=${encodeURIComponent(fileId)}&k=${encodeURIComponent(
    token,
  )}&disposition=inline`;

  /* ---------- křivka ---------- */

  useEffect(() => {
    let zivy = true;
    if (velikost !== null && velikost > STROP_PRO_KRIVKU) {
      setKrivkaStav('nejde');
      return;
    }
    spocitejKrivku(src)
      .then((p) => {
        if (!zivy) return;
        setPeaks(p);
        setKrivkaStav('hotovo');
      })
      .catch(() => zivy && setKrivkaStav('nejde'));
    return () => {
      zivy = false;
    };
  }, [src, velikost]);

  const kresli = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || 72;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const c = canvas.getContext('2d');
    if (!c) return;
    c.save();
    c.scale(dpr, dpr);
    c.clearRect(0, 0, w, h);

    const stred = h / 2;
    const kurzor = delka > 0 ? (ted / delka) * w : -1;

    if (peaks) {
      const sirka = w / peaks.length;
      for (let i = 0; i < peaks.length; i += 1) {
        const [mn, mx] = peaks[i];
        const x = i * sirka;
        c.fillStyle = x < kurzor ? '#7B55FF' : '#a29c8f';
        c.fillRect(x, stred - mx * stred, Math.max(1, sirka - 0.4), Math.max(1, (mx - mn) * stred));
      }
    } else {
      // Bez krivky aspon casova osa, at je kam klikat a kam kreslit znacky.
      c.fillStyle = '#d8d4cc';
      c.fillRect(0, stred - 1, w, 2);
      if (kurzor > 0) {
        c.fillStyle = '#7B55FF';
        c.fillRect(0, stred - 1, kurzor, 2);
      }
    }

    // Znacky pripominek - cervene, at se nespletou s kurzorem.
    c.fillStyle = '#c0432f';
    if (delka > 0) {
      pripominky.forEach((p) => {
        c.fillRect(Math.max(0, (p.cas / delka) * w - 1.5), 0, 3, h);
      });
    }

    // Kurzor je zelený - stejně jako u audioknih (zadání 12. 9. 2026).
    if (kurzor >= 0) {
      c.fillStyle = '#1FDF67';
      c.fillRect(Math.max(0, kurzor - 1), 0, 2, h);
    }
    c.restore();
  }, [peaks, pripominky, ted, delka]);

  useEffect(() => {
    kresli();
  }, [kresli]);

  useEffect(() => {
    const prekresli = () => kresli();
    window.addEventListener('resize', prekresli);
    return () => window.removeEventListener('resize', prekresli);
  }, [kresli]);

  /* ---------- přehrávač ---------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const naCas = () => setTed(video.currentTime);
    const naDelku = () => setDelka(Number.isFinite(video.duration) ? video.duration : 0);
    video.addEventListener('timeupdate', naCas);
    video.addEventListener('seeked', naCas);
    video.addEventListener('loadedmetadata', naDelku);
    video.addEventListener('durationchange', naDelku);
    return () => {
      video.removeEventListener('timeupdate', naCas);
      video.removeEventListener('seeked', naCas);
      video.removeEventListener('loadedmetadata', naDelku);
      video.removeEventListener('durationchange', naDelku);
    };
  }, []);

  const skoc = useCallback((sekundy: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, sekundy);
    setTed(video.currentTime);
  }, []);

  /* ---------- zápis ---------- */

  async function pridej(e: React.FormEvent) {
    e.preventDefault();
    const obsah = text.trim();
    if (!obsah || posilam) return;
    setPosilam(true);
    setChyba(null);
    try {
      const res = await fetch('/api/reklama/pripominky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: token, soubor: fileId, cas: znacka ?? ted, text: obsah }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Připomínku se nepodařilo uložit.');
        return;
      }
      setPripominky((c) => [...c, data as PripominkaKVideu].sort((a, b) => a.cas - b.cas));
      setText('');
      setZnacka(null);
    } catch {
      setChyba('Připomínku se nepodařilo uložit.');
    } finally {
      setPosilam(false);
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

  async function smaz(id: string) {
    setPripominky((c) => c.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/reklama/pripominky/${id}?k=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
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

  const neodeslane = pripominky.filter((p) => !p.odeslanoAt);
  const posledniOdeslani = pripominky
    .map((p) => p.odeslanoAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  async function odesli() {
    if (odesilam || neodeslane.length === 0) return;
    setOdesilam(true);
    setChyba(null);
    try {
      const res = await fetch('/api/reklama/pripominky/odeslat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: token, soubor: fileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Odeslání se nezdařilo.');
        return;
      }
      await nactiZnovu();
    } catch {
      setChyba('Odeslání se nezdařilo.');
    } finally {
      setOdesilam(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* VLEVO: video a pod ním zvuková stopa. */}
      <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
        <div className="bg-black rounded-card overflow-hidden border border-line">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={src}
            controls
            preload="metadata"
            playsInline
            className="w-full max-h-[58vh] bg-black"
          />
        </div>

        <div className="bg-surface rounded-card border border-line shadow-sm p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-heading font-semibold text-[11px] uppercase tracking-[0.12em] text-muted">
              Zvuková stopa
              {krivkaStav === 'pocita' && <span className="ml-2 normal-case tracking-normal">kreslím křivku…</span>}
              {krivkaStav === 'nejde' && (
                <span className="ml-2 normal-case tracking-normal">
                  křivku se nepodařilo vykreslit — čas se bere z přehrávače
                </span>
              )}
            </span>
            <span className="font-heading text-sm text-ink tabular-nums">
              {cas(ted)} {delka > 0 && <span className="text-muted">/ {cas(delka)}</span>}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            className="w-full h-[72px] block bg-field cursor-pointer rounded-lg"
            onClick={(e) => {
              const ramecek = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - ramecek.left;
              if (!delka) return;
              const trefa = pripominky.find(
                (p) => Math.abs((p.cas / delka) * ramecek.width - x) < 6,
              );
              skoc(trefa ? trefa.cas : (x / ramecek.width) * delka);
            }}
          />

          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              video?.pause();
              setZnacka(video ? video.currentTime : ted);
            }}
            className="self-start bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors"
          >
            Označit místo ({cas(znacka ?? ted)})
          </button>
        </div>
      </div>

      {/* VPRAVO: zápis připomínek. Žádné jméno - jen text, čas a odeslání. */}
      <aside className="w-full lg:w-[380px] shrink-0 flex flex-col gap-3">
        <form
          onSubmit={pridej}
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
          {chyba && <p className="text-xs font-body text-danger m-0">{chyba}</p>}
          <button
            type="submit"
            disabled={posilam || !text.trim()}
            className="font-heading font-semibold text-sm rounded-lg border border-brand-purple px-4 py-2 text-brand-purple hover:bg-brand-purple hover:text-white transition-colors disabled:opacity-50"
          >
            {posilam ? 'Zapisuji…' : 'Zapsat k času'}
          </button>
        </form>

        <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-baseline justify-between gap-2">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Připomínky
            </h2>
            <span className="text-xs font-body text-muted">
              {pripominky.length === 0 ? 'zatím žádné' : `${pripominky.length} celkem`}
            </span>
          </div>
          <div className="max-h-[46vh] overflow-y-auto divide-y divide-line">
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
                  <p
                    className={`text-sm font-body text-ink m-0 break-words ${
                      p.vyrizeno ? 'line-through' : ''
                    }`}
                  >
                    {p.text}
                  </p>
                  {!p.odeslanoAt && (
                    <span className="block text-[11px] font-body text-status-progress mt-0.5">
                      zatím neodesláno
                    </span>
                  )}
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
          <div className="border-t border-line p-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => void odesli()}
              disabled={odesilam || neodeslane.length === 0}
              className="w-full bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2.5 disabled:opacity-50"
            >
              {odesilam
                ? 'Odesílám…'
                : neodeslane.length > 0
                  ? `Odeslat připomínky (${neodeslane.length})`
                  : 'Vše odesláno'}
            </button>
            {posledniOdeslani && (
              <span className="text-[11px] font-body text-muted text-center">
                Naposledy odesláno{' '}
                {new Intl.DateTimeFormat('cs-CZ', {
                  day: 'numeric',
                  month: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(posledniOdeslani))}
              </span>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
