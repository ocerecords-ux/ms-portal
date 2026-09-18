'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STROP_PRO_KRIVKU, spocitejKrivku, type Peaks } from '@/lib/krivkaZvuku';
import type { PripominkaKVideu, SpotVeSlozce } from '@/lib/reklamaPripominky';

/**
 * TAGGER REKLAMNÍHO SPOTU (zadání 18. 9. 2026, upřesněné tentýž den dvakrát).
 *
 * Soubor se pořád jmenuje VideoTagger.tsx - přejmenovat ho vzdáleně nejde -
 * ale komponenta uvnitř je SpotTagger a zvládá obojí:
 *
 * - VIDEO: vlevo náhled, pod ním zvuková stopa, vpravo připomínky.
 * - SAMOTNÝ ZVUK („udělej variantu, kdy tam bude jen zvuková stopa a ta bude
 *   zobrazena místo videa v levé části a bude se markovat jen ve zvuku"):
 *   žádný přehrávač s černým pruhem, jen velká vlna přes celou levou část
 *   a vlastní ovládání v barvách portálu.
 *
 * VÍC SPOTŮ V JEDNÉ SLOŽCE („v 90 % případů tam bude jedna stopa, ale může se
 * stát, že jich tam bude i více"): nad obsahem je řádek s přepínačem. Když je
 * spot jediný, přepínač se nekreslí vůbec - nemá mezi čím vybírat. Připomínky
 * patří vždycky ke konkrétnímu souboru, takže se přepnutím vymění i seznam.
 *
 * KŘIVKA JE NAŠE, NE OD PŘEHRÁVAČE - kreslí se do plátna stejně jako
 * u audioknih (Preposlech.tsx): přehraná část fialová, zbytek šedý, zelený
 * kurzor, červené značky v místech připomínek.
 */

function cas(sekundy: number): string {
  if (!Number.isFinite(sekundy) || sekundy < 0) sekundy = 0;
  const m = Math.floor(sekundy / 60);
  const s = sekundy - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export function SpotTagger({
  token,
  spoty,
  vybranyId,
  pocatecni,
  jsemZTymu,
}: {
  token: string;
  /** Zvuk i video z kořenové složky projektu. */
  spoty: SpotVeSlozce[];
  vybranyId: string;
  pocatecni: PripominkaKVideu[];
  jsemZTymu: boolean;
}) {
  const [aktivniId, setAktivniId] = useState(vybranyId);
  const spot = useMemo(
    () => spoty.find((s) => s.id === aktivniId) ?? spoty[0] ?? null,
    [spoty, aktivniId],
  );

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pripominky, setPripominky] = useState<PripominkaKVideu[]>(pocatecni);
  const [text, setText] = useState('');
  const [znacka, setZnacka] = useState<number | null>(null);
  const [ted, setTed] = useState(0);
  const [delka, setDelka] = useState(0);
  const [hraje, setHraje] = useState(false);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [krivkaStav, setKrivkaStav] = useState<'pocita' | 'hotovo' | 'nejde'>('pocita');
  const [posilam, setPosilam] = useState(false);
  const [odesilam, setOdesilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const fileId = spot?.id ?? '';
  const src = fileId
    ? `/api/drive/download?fileId=${encodeURIComponent(fileId)}&k=${encodeURIComponent(
        token,
      )}&disposition=inline`
    : '';

  /* ---------- přepnutí spotu ---------- */

  const nactiZnovu = useCallback(
    async (idSouboru = fileId) => {
      if (!idSouboru) return;
      try {
        const res = await fetch(
          `/api/reklama/pripominky?k=${encodeURIComponent(token)}&soubor=${encodeURIComponent(
            idSouboru,
          )}`,
          { cache: 'no-store' },
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) setPripominky(data.pripominky ?? []);
      } catch {
        // nevadi - seznam zustane, jaky je
      }
    },
    [token, fileId],
  );

  useEffect(() => {
    if (aktivniId === vybranyId) return;
    // Adresa jde s vyberem, at se da poslat odkaz presne na ten spot.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('soubor', aktivniId);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // nevadi
    }
    setPeaks(null);
    setKrivkaStav('pocita');
    setTed(0);
    setDelka(0);
    setZnacka(null);
    void nactiZnovu(aktivniId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktivniId]);

  /* ---------- křivka ---------- */

  useEffect(() => {
    let zivy = true;
    if (!src) return;
    if (spot?.velikost !== null && spot?.velikost !== undefined && spot.velikost > STROP_PRO_KRIVKU) {
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
  }, [src, spot?.velikost]);

  const jenZvuk = spot ? !spot.jeVideo : false;
  const vyskaKrivky = jenZvuk ? 200 : 72;

  const kresli = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || vyskaKrivky;
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
  }, [peaks, pripominky, ted, delka, vyskaKrivky]);

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
    const media = mediaRef.current;
    if (!media) return;
    const naCas = () => setTed(media.currentTime);
    const naDelku = () => setDelka(Number.isFinite(media.duration) ? media.duration : 0);
    const naHraje = () => setHraje(true);
    const naStop = () => setHraje(false);
    media.addEventListener('timeupdate', naCas);
    media.addEventListener('seeked', naCas);
    media.addEventListener('loadedmetadata', naDelku);
    media.addEventListener('durationchange', naDelku);
    media.addEventListener('play', naHraje);
    media.addEventListener('pause', naStop);
    media.addEventListener('ended', naStop);
    return () => {
      media.removeEventListener('timeupdate', naCas);
      media.removeEventListener('seeked', naCas);
      media.removeEventListener('loadedmetadata', naDelku);
      media.removeEventListener('durationchange', naDelku);
      media.removeEventListener('play', naHraje);
      media.removeEventListener('pause', naStop);
      media.removeEventListener('ended', naStop);
    };
  }, [jenZvuk, fileId]);

  const skoc = useCallback((sekundy: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = Math.max(0, sekundy);
    setTed(media.currentTime);
  }, []);

  function prehrajNeboStop() {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) void media.play().catch(() => undefined);
    else media.pause();
  }

  /* ---------- zápis ---------- */

  async function pridej(e: React.FormEvent) {
    e.preventDefault();
    const obsah = text.trim();
    if (!obsah || posilam || !fileId) return;
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
    if (odesilam || neodeslane.length === 0 || !fileId) return;
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

  if (!spot) {
    return (
      <p className="text-sm font-body text-muted m-0">
        Ve složce projektu zatím není žádný spot k poslechu.
      </p>
    );
  }

  const krivka = (
    <>
      <canvas
        ref={canvasRef}
        style={{ height: vyskaKrivky }}
        className="w-full block bg-field cursor-pointer rounded-lg"
        onClick={(e) => {
          const ramecek = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - ramecek.left;
          if (!delka) return;
          const trefa = pripominky.find((p) => Math.abs((p.cas / delka) * ramecek.width - x) < 6);
          skoc(trefa ? trefa.cas : (x / ramecek.width) * delka);
        }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        {/* Vlastni ovladani - cerny systemovy pruh prohlizece se v portalu
            nepouziva (zadani 5. 9. 2026: „ten černý pruh je hnusný"). */}
        <button
          type="button"
          onClick={prehrajNeboStop}
          title={hraje ? 'Pozastavit' : 'Přehrát'}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-green text-onAccent"
        >
          {hraje ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M7 5v14l11-7z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => skoc(ted - 5)}
          title="O pět vteřin zpět"
          className="h-9 px-3 rounded-lg border border-line text-xs font-heading font-semibold text-muted hover:text-brand-purple"
        >
          −5 s
        </button>
        <button
          type="button"
          onClick={() => {
            mediaRef.current?.pause();
            setZnacka(mediaRef.current ? mediaRef.current.currentTime : ted);
          }}
          className="h-9 px-4 rounded-lg bg-brand-purple text-white font-heading font-semibold text-sm hover:bg-brand-purpleDeep transition-colors"
        >
          Označit místo ({cas(znacka ?? ted)})
        </button>
        <span className="ml-auto font-heading text-sm text-ink tabular-nums">
          {cas(ted)} {delka > 0 && <span className="text-muted">/ {cas(delka)}</span>}
        </span>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Přepínač spotů - jen když je z čeho vybírat. */}
      {spoty.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-heading font-semibold text-[11px] uppercase tracking-[0.12em] text-muted">
            Spoty ve složce
          </span>
          {spoty.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAktivniId(s.id)}
              title={s.nazev}
              aria-pressed={s.id === spot.id}
              className={`px-3 py-1.5 rounded-pill text-xs font-heading font-semibold transition-colors max-w-[240px] truncate ${
                s.id === spot.id
                  ? 'bg-brand-purple text-white'
                  : 'bg-surface border border-line text-muted hover:text-brand-purple'
              }`}
            >
              {i + 1}. {s.nazev}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* VLEVO: u videa náhled a pod ním vlna, u zvuku rovnou velká vlna. */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
          {spot.jeVideo ? (
            <>
              <div className="bg-black rounded-card overflow-hidden border border-line">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={src}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-[58vh] bg-black"
                />
              </div>
              <div className="bg-surface rounded-card border border-line shadow-sm p-3 flex flex-col gap-2">
                <StavKrivky nazev={spot.nazev} stav={krivkaStav} />
                {krivka}
              </div>
            </>
          ) : (
            <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
              <StavKrivky nazev={spot.nazev} stav={krivkaStav} />
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={src} preload="metadata" className="hidden" />
              {krivka}
            </div>
          )}
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
              {spoty.length > 1 && (
                <span className="text-[11px] font-body text-muted text-center">
                  Odesílá se to, co je zapsané u tohohle spotu.
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StavKrivky({ nazev, stav }: { nazev: string; stav: 'pocita' | 'hotovo' | 'nejde' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <span className="font-heading font-semibold text-[11px] uppercase tracking-[0.12em] text-muted truncate max-w-full">
        {nazev}
      </span>
      {stav === 'pocita' && <span className="text-[11px] font-body text-muted">kreslím křivku…</span>}
      {stav === 'nejde' && (
        <span className="text-[11px] font-body text-muted">
          křivku se nepodařilo vykreslit — čas se bere z přehrávače
        </span>
      )}
    </div>
  );
}
