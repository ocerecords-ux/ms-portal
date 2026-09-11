'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * AudioTagger — přeposlech nahrávky proti textu (zadání 11. 9. 2026).
 *
 * Přeneseno z prototypu (viz projektový dokument audiotagger-v1-prototype.md)
 * do portálu. Proti prototypu se změnily dvě podstatné věci:
 *
 * 1. ZÁZNAMY CHYB PATŘÍ PROJEKTU a leží v databázi — přežijí obnovení stránky
 *    i výměnu počítače a vidí je celý tým. Dřív žily v localStorage.
 * 2. STOPY A TEXT SI PORTÁL BERE SÁM ze složky projektu na Disku. Pořadí se
 *    řídí názvem („01_", „02_"…), text je PDF končící „_RE". Ruční výběr
 *    souborů zůstal jako záloha, kdyby složka nebyla po ruce.
 *
 * ZVUK SE PŘEHRÁVÁ PROUDEM přes obyčejný <audio>, ne přes dekódování celé
 * stopy do paměti jako v prototypu. Hodinová nahrávka má po rozbalení přes
 * gigabajt a prohlížeč by to položil; takhle se stahuje jen to, co zrovna
 * hraje, a jde v ní skákat.
 *
 * KŘIVKA se počítá zvlášť a jen pro vybranou stopu: soubor se stáhne a
 * dekóduje do 8 kHz mono (OfflineAudioContext), což je pro obrázek dost a
 * paměť to unese. U příliš velkých souborů se nekreslí vůbec a zůstane
 * časová osa se značkami.
 */

type ChybaZeServeru = {
  id: string;
  trackIndex: number;
  trackName: string;
  localTime: number;
  pdfPage: number | null;
  description: string;
  createdByName: string | null;
  createdAt: string;
};

type Stav = {
  reviewed: boolean;
  reviewedByName: string | null;
  reviewedAt: string | null;
  chyby: ChybaZeServeru[];
};

type Stopa = {
  name: string;
  /** Odkaz, ze kterého se stopa přehrává (Disk přes portál, nebo blob z disku). */
  url: string;
  /** Velikost v bajtech — podle ní se rozhoduje, jestli kreslit křivku. */
  velikost: number | null;
  peaks: [number, number][] | null;
  /** Křivku už zkoušíme spočítat / spočítat nešla. */
  krivkaStav: 'ceka' | 'pocita' | 'hotovo' | 'nejde';
};

const DELKA_STOPY_V_CUBASE = 3600; // stopa 01 -> 0 h, 02 -> 1 h, 03 -> 2 h…

/** Nad tuhle velikost se křivka nekreslí - dekódování by sežralo paměť. */
const STROP_PRO_KRIVKU = 150 * 1024 * 1024;

/** Vzorkování pro křivku. Na obrázek široký pár set bodů to bohatě stačí. */
const KRIVKA_HZ = 8000;

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function cas(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${pad2(m)}:${s.toFixed(1).padStart(4, '0')}`;
}

function hms(sec: number): string {
  const cele = Math.max(0, Math.round(sec));
  return `${pad2(Math.floor(cele / 3600))}:${pad2(Math.floor((cele % 3600) / 60))}:${pad2(cele % 60)}`;
}

/**
 * Natáhne pdf.js z CDN až ve chvíli, kdy je potřeba.
 *
 * Schválně to NENÍ `import('https://…')`: takový import se snaží přeložit
 * balíčkovač i TypeScript a ani jeden vzdálenou adresu neumí. Modul se proto
 * vkládá jako obyčejný `<script type="module">`, který si hotovou knihovnu
 * odloží na `window`. Načte se jen jednou za život stránky.
 */
function nactiPdfJs(): Promise<any> {
  const okno = window as unknown as { __pdfjs?: any };
  if (okno.__pdfjs) return Promise.resolve(okno.__pdfjs);

  return new Promise((hotovo, chyba) => {
    const hlaska = 'preposlech-pdfjs';
    window.addEventListener(
      hlaska,
      (e: Event) => {
        const detail = (e as CustomEvent<{ ok: boolean }>).detail;
        if (detail?.ok && okno.__pdfjs) hotovo(okno.__pdfjs);
        else chyba(new Error('pdf.js se nepodařilo načíst'));
      },
      { once: true },
    );

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent =
      `import * as pdfjs from "${PDFJS_CDN}/pdf.min.mjs";\n` +
      `window.__pdfjs = pdfjs;\n` +
      `window.dispatchEvent(new CustomEvent("${hlaska}", { detail: { ok: true } }));`;
    script.onerror = () => window.dispatchEvent(new CustomEvent(hlaska, { detail: { ok: false } }));
    document.head.appendChild(script);
  });
}

/**
 * Stáhne stopu a spočítá z ní křivku. Dekóduje se do 8 kHz mono, takže
 * z hodinové nahrávky vznikne pár desítek MB místo gigabajtu.
 */
async function spocitejKrivku(url: string, pocet = 640): Promise<[number, number][]> {
  const odpoved = await fetch(url);
  if (!odpoved.ok) throw new Error('nelze stáhnout');
  const data = await odpoved.arrayBuffer();

  const Offline =
    (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Offline(1, KRIVKA_HZ, KRIVKA_HZ);
  const buffer = await ctx.decodeAudioData(data);

  const vzorky = buffer.getChannelData(0);
  const velikost = vzorky.length / pocet;
  const strop = 64;
  const peaks: [number, number][] = new Array(pocet);
  for (let i = 0; i < pocet; i += 1) {
    const od = Math.floor(i * velikost);
    const do_ = Math.max(od + 1, Math.floor((i + 1) * velikost));
    const krok = Math.max(1, Math.floor((do_ - od) / strop));
    let min = 0;
    let max = 0;
    for (let j = od; j < do_; j += krok) {
      const v = vzorky[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[i] = [min, max];
  }
  return peaks;
}

export function Preposlech({
  caflouProjectId,
  projectName,
  pocatecniStav,
  /** Klientský režim: poslouchá a zapisuje, ale se stopami nehýbe. */
  jenPoslech = false,
  /** Vstupenka z mailu. Když je, jde s každým požadavkem místo přihlášení. */
  token = null,
}: {
  caflouProjectId: string;
  projectName: string;
  pocatecniStav: Stav;
  jenPoslech?: boolean;
  token?: string | null;
}) {
  const [stav, setStav] = useState<Stav>(pocatecniStav);
  const [stopy, setStopy] = useState<Stopa[]>([]);
  const [aktivni, setAktivni] = useState<number | null>(null);
  const [hraje, setHraje] = useState(false);
  const [pozice, setPozice] = useState(0);
  const [delka, setDelka] = useState(0);

  const [zDisku, setZDisku] = useState<'ceka' | 'nacitam' | 'hotovo' | 'nejde'>('ceka');
  const [poznamka, setPoznamka] = useState<string | null>(null);
  const [slozkaUrl, setSlozkaUrl] = useState<string | null>(null);

  const [pdfNazev, setPdfNazev] = useState('');
  const [pdfStran, setPdfStran] = useState(0);
  const [pdfStrana, setPdfStrana] = useState(1);

  const [formOtevreny, setFormOtevreny] = useState(false);
  const [popis, setPopis] = useState('');
  const [zachyt, setZachyt] = useState<{ trackIndex: number; trackName: string; localTime: number; pdfPage: number | null } | null>(null);
  const [uklada, setUklada] = useState(false);
  const [chybaHlaska, setChybaHlaska] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopyRef = useRef<Stopa[]>([]);
  const aktivniRef = useRef<number | null>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfObalRef = useRef<HTMLDivElement | null>(null);
  const popisRef = useRef<HTMLTextAreaElement | null>(null);
  const vytvoreneUrl = useRef<string[]>([]);

  useEffect(() => {
    stopyRef.current = stopy;
  }, [stopy]);
  useEffect(() => {
    aktivniRef.current = aktivni;
  }, [aktivni]);

  // Blob URL z rucne vybranych souboru je potreba po sobe uklidit.
  useEffect(
    () => () => {
      vytvoreneUrl.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const zaklad = `/api/projekty/${encodeURIComponent(caflouProjectId)}/preposlech`;

  /**
   * Klient z mailu není přihlášený, takže se ke každé adrese přilepí token.
   * Týmu se nepřilepuje nic a pozná se podle sezení jako dosud.
   */
  const sKlicem = useCallback(
    (url: string): string => (token ? `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(token)}` : url),
    [token],
  );

  /* ---------- křivka ---------- */

  const kresliStopu = useCallback(
    (index: number) => {
      const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-stopa="${index}"]`);
      const stopa = stopyRef.current[index];
      if (!canvas || !stopa) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 600;
      const h = canvas.clientHeight || 56;
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
      const jeAktivni = index === aktivniRef.current;
      const trvani = jeAktivni && delka > 0 ? delka : 0;
      const kurzor = jeAktivni && trvani ? (pozice / trvani) * w : -1;

      if (stopa.peaks) {
        const sirkaSloupce = w / stopa.peaks.length;
        for (let i = 0; i < stopa.peaks.length; i += 1) {
          const [mn, mx] = stopa.peaks[i];
          const x = i * sirkaSloupce;
          c.fillStyle = jeAktivni && x < kurzor ? '#7B55FF' : '#a29c8f';
          c.fillRect(x, stred - mx * stred, Math.max(1, sirkaSloupce - 0.4), Math.max(1, (mx - mn) * stred));
        }
      } else {
        // Bez krivky aspon casova osa, at je kam klikat a kam kreslit znacky.
        c.fillStyle = '#d8d4cc';
        c.fillRect(0, stred - 1, w, 2);
        if (jeAktivni && kurzor > 0) {
          c.fillStyle = '#7B55FF';
          c.fillRect(0, stred - 1, kurzor, 2);
        }
      }

      // Znacky chyb - podle poradi stopy, ne podle nejakeho ID.
      c.fillStyle = '#c0432f';
      stav.chyby
        .filter((ch) => ch.trackIndex === index + 1)
        .forEach((ch) => {
          if (!trvani) return;
          c.fillRect(Math.max(0, (ch.localTime / trvani) * w - 1.5), 0, 3, h);
        });

      if (jeAktivni && kurzor >= 0) c.fillRect(Math.max(0, kurzor - 0.5), 0, 1, h);
      c.restore();
    },
    [delka, pozice, stav.chyby],
  );

  const kresliVse = useCallback(() => {
    stopyRef.current.forEach((_, i) => kresliStopu(i));
  }, [kresliStopu]);

  useEffect(() => {
    kresliVse();
  }, [kresliVse, stopy, pozice, delka, stav.chyby]);

  useEffect(() => {
    window.addEventListener('resize', kresliVse);
    return () => window.removeEventListener('resize', kresliVse);
  }, [kresliVse]);

  /** Křivku počítáme až pro vybranou stopu — ne pro všechny najednou. */
  useEffect(() => {
    if (aktivni === null) return;
    const stopa = stopyRef.current[aktivni];
    if (!stopa || stopa.krivkaStav !== 'ceka') return;

    if (stopa.velikost !== null && stopa.velikost > STROP_PRO_KRIVKU) {
      setStopy((s) => s.map((x, i) => (i === aktivni ? { ...x, krivkaStav: 'nejde' } : x)));
      return;
    }

    let zruseno = false;
    setStopy((s) => s.map((x, i) => (i === aktivni ? { ...x, krivkaStav: 'pocita' } : x)));
    spocitejKrivku(stopa.url)
      .then((peaks) => {
        if (zruseno) return;
        setStopy((s) => s.map((x, i) => (i === aktivni ? { ...x, peaks, krivkaStav: 'hotovo' } : x)));
      })
      .catch(() => {
        if (zruseno) return;
        setStopy((s) => s.map((x, i) => (i === aktivni ? { ...x, krivkaStav: 'nejde' } : x)));
      });

    return () => {
      zruseno = true;
    };
  }, [aktivni]);

  /* ---------- přehrávání ---------- */

  const vyberStopu = useCallback((index: number, skocNa?: number) => {
    const stopa = stopyRef.current[index];
    const audio = audioRef.current;
    if (!stopa || !audio) return;
    setAktivni(index);
    aktivniRef.current = index;
    if (audio.src !== stopa.url) {
      audio.src = stopa.url;
      audio.load();
    }
    setDelka(Number.isFinite(audio.duration) ? audio.duration : 0);
    if (typeof skocNa === 'number') {
      const nastav = () => {
        audio.currentTime = skocNa;
        setPozice(skocNa);
      };
      if (audio.readyState >= 1) nastav();
      else audio.addEventListener('loadedmetadata', nastav, { once: true });
    } else {
      audio.currentTime = 0;
      setPozice(0);
    }
  }, []);

  function prehrajNeboPauzni() {
    const audio = audioRef.current;
    if (!audio || aktivni === null) return;
    if (audio.paused) void audio.play().catch(() => setChybaHlaska('Nahrávku se nepodařilo přehrát.'));
    else audio.pause();
  }

  const skoc = useCallback((kam: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const cil = Math.max(0, Math.min(kam, audio.duration));
    audio.currentTime = cil;
    setPozice(cil);
  }, []);

  /* ---------- načtení ze složky projektu ---------- */

  const nactiZDisku = useCallback(async () => {
    setZDisku('nacitam');
    setChybaHlaska(null);
    try {
      const res = await fetch(sKlicem(`${zaklad}/stopy`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setZDisku('nejde');
        setPoznamka(data?.error || 'Složku projektu se nepodařilo načíst.');
        return;
      }

      const nove: Stopa[] = (data.stopy ?? []).map((s: { id: string; name: string; velikost: number | null }) => ({
        name: s.name,
        url: sKlicem(`${zaklad}/soubor?soubor=${encodeURIComponent(s.id)}`),
        velikost: s.velikost,
        peaks: null,
        krivkaStav: 'ceka' as const,
      }));

      setStopy(nove);
      stopyRef.current = nove;
      setSlozkaUrl(data.slozkaUrl ?? null);
      setPoznamka(data.poznamkaKTextu ?? null);
      setZDisku('hotovo');

      if (nove.length > 0) setTimeout(() => vyberStopu(0), 0);
      if (data.text?.id) {
        void nactiPdfZUrl(sKlicem(`${zaklad}/soubor?soubor=${encodeURIComponent(data.text.id)}`), data.text.name);
      }
    } catch {
      setZDisku('nejde');
      setPoznamka('Složku projektu se nepodařilo načíst.');
    }
  }, [zaklad, sKlicem, vyberStopu]);

  useEffect(() => {
    void nactiZDisku();
    // Schvalne jen pri otevreni - dalsi nacteni si clovek vyzada tlacitkem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- PDF ---------- */

  async function vykresliPdf(doc: any) {
    const obal = pdfObalRef.current;
    if (!obal) return;
    obal.innerHTML = '';
    const prvni = await doc.getPage(1);
    const sirka = obal.clientWidth - 32;
    const zvetseni = Math.max(0.3, Math.min(4, sirka / prvni.getViewport({ scale: 1 }).width));

    for (let n = 1; n <= doc.numPages; n += 1) {
      const stranka = await doc.getPage(n);
      const viewport = stranka.getViewport({ scale: zvetseni });
      const ramecek = document.createElement('div');
      ramecek.className = 'relative shadow-md bg-white';
      ramecek.dataset.strana = String(n);
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'block';
      ramecek.appendChild(canvas);
      const cislo = document.createElement('span');
      cislo.textContent = String(n);
      cislo.className = 'absolute top-1.5 left-1.5 bg-ink/60 text-white text-[10px] font-heading rounded px-1.5 py-0.5';
      ramecek.appendChild(cislo);
      obal.appendChild(ramecek);
      await stranka.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
  }

  async function nactiPdfZUrl(url: string, nazev: string) {
    try {
      const pdfjs = await nactiPdfJs();
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`;
      const doc = await pdfjs.getDocument({ url }).promise;
      pdfDocRef.current = doc;
      setPdfNazev(nazev);
      setPdfStran(doc.numPages);
      setPdfStrana(1);
      await vykresliPdf(doc);
    } catch {
      setPoznamka(`Text „${nazev}" se nepodařilo otevřít.`);
    }
  }

  async function nactiPdfZeSouboru(file: File) {
    const url = URL.createObjectURL(file);
    vytvoreneUrl.current.push(url);
    await nactiPdfZUrl(url, file.name);
  }

  function naStranu(n: number) {
    if (!pdfDocRef.current) return;
    const cil = Math.min(Math.max(1, n), pdfStran);
    setPdfStrana(cil);
    pdfObalRef.current?.querySelector(`[data-strana="${cil}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Ruční záloha, když složka projektu není po ruce. */
  function pridejStopyZeSouboru(seznam: FileList) {
    const soubory = Array.from(seznam).sort((a, b) => a.name.localeCompare(b.name, 'cs', { numeric: true }));
    const nove: Stopa[] = soubory.map((file) => {
      const url = URL.createObjectURL(file);
      vytvoreneUrl.current.push(url);
      return { name: file.name, url, velikost: file.size, peaks: null, krivkaStav: 'ceka' as const };
    });
    setStopy((s) => {
      const dalsi = [...s, ...nove];
      stopyRef.current = dalsi;
      return dalsi;
    });
    if (aktivniRef.current === null && nove.length > 0) setTimeout(() => vyberStopu(0), 0);
  }

  /* ---------- záznamy chyb ---------- */

  async function posli(cesta: string, init: RequestInit): Promise<boolean> {
    setChybaHlaska(null);
    try {
      const res = await fetch(cesta, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChybaHlaska(data?.error || 'Nepodařilo se uložit.');
        return false;
      }
      setStav(data as Stav);
      return true;
    } catch {
      setChybaHlaska('Nepodařilo se uložit.');
      return false;
    }
  }

  function otevriForm() {
    if (aktivni === null) return;
    audioRef.current?.pause();
    const stopa = stopyRef.current[aktivni];
    setZachyt({
      trackIndex: aktivni + 1,
      trackName: stopa.name,
      localTime: audioRef.current?.currentTime ?? 0,
      pdfPage: pdfDocRef.current ? pdfStrana : null,
    });
    setPopis('');
    setFormOtevreny(true);
    setTimeout(() => popisRef.current?.focus(), 0);
  }

  async function ulozChybu() {
    if (!zachyt || !popis.trim() || uklada) return;
    setUklada(true);
    const ok = await posli(sKlicem(zaklad), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...zachyt, description: popis.trim() }),
    });
    setUklada(false);
    if (ok) {
      setFormOtevreny(false);
      setZachyt(null);
      setPopis('');
    }
  }

  async function smazChybu(id: string) {
    await posli(sKlicem(`${zaklad}?chyba=${encodeURIComponent(id)}`), { method: 'DELETE' });
  }

  async function prepniPreposlechnuto() {
    await posli(sKlicem(zaklad), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: !stav.reviewed }),
    });
  }

  function skocNaChybu(ch: ChybaZeServeru) {
    const index = ch.trackIndex - 1;
    if (stopyRef.current[index]) {
      if (index !== aktivniRef.current) vyberStopu(index, ch.localTime);
      else skoc(ch.localTime);
    }
    if (ch.pdfPage) naStranu(ch.pdfPage);
  }

  /* ---------- klávesy ---------- */

  useEffect(() => {
    function stisk(e: KeyboardEvent) {
      const cil = e.target as HTMLElement | null;
      if (cil && (cil.tagName === 'INPUT' || cil.tagName === 'TEXTAREA')) return;
      if (formOtevreny) return;
      if (e.code === 'Space') {
        e.preventDefault();
        prehrajNeboPauzni();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skoc((audioRef.current?.currentTime ?? 0) + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skoc((audioRef.current?.currentTime ?? 0) - 5);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        otevriForm();
      }
    }
    window.addEventListener('keydown', stisk);
    return () => window.removeEventListener('keydown', stisk);
  });

  const chybejiciStopy = useMemo(() => {
    const nactene = new Set(stopy.map((_, i) => i + 1));
    return stav.chyby.some((ch) => !nactene.has(ch.trackIndex));
  }, [stav.chyby, stopy]);

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

  return (
    <div className="flex flex-col gap-4">
      {/* Prehravac sam o sobe nic nekresli - zvuk tece proudem z Disku. */}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => setDelka(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setPozice(e.currentTarget.currentTime)}
        onPlay={() => setHraje(true)}
        onPause={() => setHraje(false)}
        onEnded={() => setHraje(false)}
        onError={() => setChybaHlaska('Stopu se nepodařilo načíst z Disku.')}
        className="hidden"
      />

      <div className="bg-brand-purple text-white rounded-card px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">AudioTagger</h2>
          <p className="text-xs font-body text-white/80 m-0 mt-0.5 truncate">{projectName}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-heading text-white/80">
            Stop: <b className="text-white">{stopy.length}</b> · Chyb:{' '}
            <b className="text-white">{stav.chyby.length}</b> · Text:{' '}
            <b className="text-white">{pdfNazev || '—'}</b>
          </span>
          <span className="text-[11px] font-heading text-white/60 hidden lg:inline">
            Mezerník = přehrát · ←/→ = ±5 s · E = přidat chybu
          </span>
          {!jenPoslech && (
            <button
              type="button"
              onClick={prepniPreposlechnuto}
              className={`font-heading font-semibold text-xs rounded-lg px-3 py-1.5 transition-colors ${
                stav.reviewed ? 'bg-brand-green text-onAccent' : 'border border-white/40 text-white hover:border-white'
              }`}
            >
              {stav.reviewed ? '☑ Přeposlechnuto' : '☐ Přeposlechnuto'}
            </button>
          )}
        </div>
      </div>

      {chybaHlaska && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{chybaHlaska}</p>
      )}
      {poznamka && (
        <p className="text-xs font-body text-status-progress bg-warnTint border border-line rounded-lg px-4 py-2.5 m-0">
          {poznamka}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-4 items-start">
        <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b border-line">
            <span className="text-sm font-heading text-ink truncate">{pdfNazev || 'Text nahrávky'}</span>
            {!jenPoslech && (
              <label className="text-xs font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
                Načíst jiné PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void nactiPdfZeSouboru(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {pdfStran > 0 && (
              <span className="flex items-center gap-1.5 ml-auto">
                <button type="button" onClick={() => naStranu(pdfStrana - 1)} className="text-muted hover:text-brand-purple px-1.5">
                  ◂
                </button>
                <input
                  type="number"
                  min={1}
                  max={pdfStran}
                  value={pdfStrana}
                  onChange={(e) => naStranu(Number(e.target.value) || 1)}
                  className={`${inputClass} w-16 text-center tabular-nums py-1`}
                />
                <span className="text-xs font-heading text-muted tabular-nums">/ {pdfStran}</span>
                <button type="button" onClick={() => naStranu(pdfStrana + 1)} className="text-muted hover:text-brand-purple px-1.5">
                  ▸
                </button>
              </span>
            )}
          </div>
          <div ref={pdfObalRef} className="bg-field overflow-y-auto p-4 flex flex-col items-center gap-4" style={{ height: '72vh' }}>
            {pdfStran === 0 && (
              <p className="text-sm font-body text-muted m-auto text-center max-w-[300px]">
                {zDisku === 'nacitam'
                  ? 'Načítám text ze složky projektu…'
                  : 'Ve složce projektu zatím není text. Hledá se PDF, jehož název končí _RE.'}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Záznamy chyb ({stav.chyby.length})
              </h3>
              {chybejiciStopy && (
                <span className="text-[11px] font-body text-status-progress">
                  Některé záznamy patří stopám, které tu teď nejsou.
                </span>
              )}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '30vh' }}>
              {stav.chyby.length === 0 ? (
                <p className="text-sm font-body text-muted m-0 px-4 py-6 text-center">
                  Zatím žádné chyby. Pusťte stopu a v místě problému dejte „Přidat chybu".
                </p>
              ) : (
                <ul className="list-none m-0 p-0 divide-y divide-line">
                  {stav.chyby.map((ch) => (
                    <li key={ch.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surfaceSoft">
                      <button type="button" onClick={() => skocNaChybu(ch)} className="flex-1 min-w-0 text-left" title="Skočit na místo v nahrávce">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-heading font-semibold tabular-nums bg-field border border-line rounded px-1.5">
                            {pad2(ch.trackIndex)}
                          </span>
                          <span className="text-xs font-heading text-muted tabular-nums">{cas(ch.localTime)}</span>
                          {ch.pdfPage && <span className="text-xs font-heading text-muted tabular-nums">s. {ch.pdfPage}</span>}
                          {!jenPoslech && (
                            <span className="text-[11px] font-heading text-muted/70 tabular-nums">
                              Cubase {hms((ch.trackIndex - 1) * DELKA_STOPY_V_CUBASE + ch.localTime)}
                            </span>
                          )}
                        </span>
                        <span className="block text-sm font-body text-ink mt-0.5 break-words">{ch.description}</span>
                        {ch.createdByName && <span className="block text-[11px] font-body text-muted mt-0.5">{ch.createdByName}</span>}
                      </button>
                      <button type="button" onClick={() => void smazChybu(ch.id)} title="Smazat záznam" className="text-muted hover:text-danger text-sm shrink-0">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={prehrajNeboPauzni}
                disabled={aktivni === null}
                title="Přehrát / pozastavit (mezerník)"
                className="w-10 h-10 rounded-full bg-brand-green text-onAccent font-heading font-bold disabled:opacity-40"
              >
                {hraje ? '❚❚' : '▶'}
              </button>
              <span className="text-xs font-heading font-semibold bg-tint text-brand-purpleDark rounded px-2 py-1 tabular-nums">
                {aktivni === null ? '—' : `Stopa ${pad2(aktivni + 1)}`}
              </span>
              <span className="text-sm font-heading text-muted tabular-nums">
                <b className="text-ink">{cas(pozice)}</b> / {cas(delka)}
              </span>
              <button
                type="button"
                onClick={otevriForm}
                disabled={aktivni === null || formOtevreny}
                className="ml-auto bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
              >
                + Přidat chybu
              </button>
            </div>
            {aktivni !== null && !jenPoslech && (
              <p className="text-[11px] font-heading text-muted m-0 tabular-nums">
                Offset této stopy v Cubase: +{hms(aktivni * DELKA_STOPY_V_CUBASE)}
              </p>
            )}

            {formOtevreny && zachyt && (
              <div className="border border-brand-purple bg-tint rounded-lg p-3 flex flex-col gap-2">
                <p className="text-xs font-heading text-muted m-0">
                  Stopa <b className="text-ink">{pad2(zachyt.trackIndex)}</b> · čas{' '}
                  <b className="text-ink tabular-nums">{cas(zachyt.localTime)}</b> · strana{' '}
                  <b className="text-ink">{zachyt.pdfPage ?? '— (text nenačtený)'}</b>
                </p>
                <textarea
                  ref={popisRef}
                  value={popis}
                  onChange={(e) => setPopis(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void ulozChybu();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setFormOtevreny(false);
                    }
                  }}
                  rows={2}
                  placeholder="Co je špatně — přeřek, chybějící věta, jiné znění než v textu…"
                  className={`${inputClass} w-full resize-none`}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setFormOtevreny(false)} className="text-sm font-heading text-muted hover:text-ink">
                    Zrušit
                  </button>
                  <button
                    type="button"
                    onClick={() => void ulozChybu()}
                    disabled={uklada || !popis.trim()}
                    className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50"
                  >
                    {uklada ? 'Ukládám…' : 'Uložit chybu'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Zvukové stopy</h3>
              {!jenPoslech && (
                <span className="flex items-center gap-3">
                  {slozkaUrl && (
                    <a href={slozkaUrl} target="_blank" rel="noreferrer" className="text-xs font-heading text-brand-purple no-underline hover:underline">
                      Složka na Disku ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void nactiZDisku()}
                    disabled={zDisku === 'nacitam'}
                    className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-50"
                  >
                    {zDisku === 'nacitam' ? 'Načítám…' : 'Načíst z Disku znovu'}
                  </button>
                  <label className="text-xs font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
                    + Ze souborů
                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) pridejStopyZeSouboru(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </span>
              )}
            </div>
            <div className="p-3 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '34vh' }}>
              {stopy.length === 0 ? (
                <p className="text-sm font-body text-muted m-0 px-1 py-5 text-center">
                  {zDisku === 'nacitam'
                    ? 'Načítám stopy ze složky projektu…'
                    : 'Ve složce projektu zatím nejsou žádné nahrávky. Stopy se řadí podle čísla na začátku názvu — 01_, 02_, 03_.'}
                </p>
              ) : (
                stopy.map((stopa, index) => (
                  <div
                    key={`${index}-${stopa.name}`}
                    className={`rounded-lg border overflow-hidden ${
                      index === aktivni ? 'border-brand-purple bg-tint' : 'border-line bg-surface'
                    }`}
                  >
                    <button type="button" onClick={() => vyberStopu(index)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left">
                      <span className="text-[11px] font-heading font-bold tabular-nums bg-field rounded px-1.5 py-0.5">{pad2(index + 1)}</span>
                      <span className="flex-1 min-w-0 text-xs font-body text-ink truncate">{stopa.name}</span>
                      {stopa.krivkaStav === 'pocita' && <span className="text-[10px] font-heading text-muted">kreslím křivku…</span>}
                      {!jenPoslech && (
                        <span className="text-[10px] font-heading text-muted tabular-nums">+{hms(index * DELKA_STOPY_V_CUBASE)}</span>
                      )}
                    </button>
                    <canvas
                      data-stopa={index}
                      className="w-full h-[56px] block bg-field cursor-pointer"
                      onClick={(e) => {
                        const ramecek = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - ramecek.left;
                        if (index !== aktivni) {
                          vyberStopu(index);
                          return;
                        }
                        const trvani = audioRef.current?.duration;
                        if (!trvani || !Number.isFinite(trvani)) return;
                        const trefa = stav.chyby.find(
                          (ch) => ch.trackIndex === index + 1 && Math.abs((ch.localTime / trvani) * ramecek.width - x) < 6,
                        );
                        if (trefa) {
                          skocNaChybu(trefa);
                          return;
                        }
                        skoc((x / ramecek.width) * trvani);
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
