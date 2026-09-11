'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * AudioTagger — přeposlech nahrávky proti textu (zadání 11. 9. 2026).
 *
 * Přeneseno z prototypu (viz projektový dokument audiotagger-v1-prototype.md)
 * do portálu. Proti prototypu se změnilo to podstatné: ZÁZNAMY CHYB PATŘÍ
 * PROJEKTU a leží v databázi, takže přežijí obnovení stránky i výměnu
 * počítače a vidí je celý tým. Dřív žily jen v localStorage jednoho
 * prohlížeče.
 *
 * Stopy a PDF se pořád vybírají ze souborů — prohlížeč je uložit neumí
 * a načítání z Disku je samostatný krok. Záznam proto ukazuje na stopu jejím
 * POŘADÍM a nese i její název; když se příště načtou soubory ve stejném
 * pořadí, značky sednou na místo, a když ne, je to v seznamu vidět.
 *
 * ZVUK je psaný rovnou na Web Audio API, ne přes knihovnu — AudioBufferSource
 * neumí pauzu, takže se pozice počítá ručně. Zvukový soubor se čte přes
 * File.arrayBuffer(), ne fetchem; v prototypu to byla nutnost (sandbox), tady
 * je to prostě nejkratší cesta bez další závislosti.
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
  id: number;
  name: string;
  file: File;
  audioBuffer: AudioBuffer | null;
  peaks: [number, number][] | null;
};

const DELKA_STOPY_V_CUBASE = 3600; // stopa 01 -> 0 h, 02 -> 1 h, 03 -> 2 h…

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
 * Zmenší dekódovaný zvuk na pevný počet sloupečků, aby kreslení waveformy
 * nezáviselo na délce stopy. Počítá se jednou po dekódování.
 */
function spocitejPeaks(buffer: AudioBuffer, pocet = 640): [number, number][] {
  const data = buffer.getChannelData(0);
  const velikost = data.length / pocet;
  const strop = 48; // kolik vzorku se nejvys prohlida v jednom sloupecku
  const peaks: [number, number][] = new Array(pocet);
  for (let i = 0; i < pocet; i += 1) {
    const od = Math.floor(i * velikost);
    const do_ = Math.max(od + 1, Math.floor((i + 1) * velikost));
    const krok = Math.max(1, Math.floor((do_ - od) / strop));
    let min = 0;
    let max = 0;
    for (let j = od; j < do_; j += krok) {
      const v = data[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[i] = [min, max];
  }
  return peaks;
}

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289';

/**
 * Natáhne pdf.js z CDN až ve chvíli, kdy je potřeba.
 *
 * Schválně to NENÍ `import('https://…')`: takový import se snaží přeložit
 * balíčkovač i TypeScript, a ani jeden vzdálenou adresu neumí. Modul se proto
 * vkládá jako obyčejný `<script type="module">`, který si hotovou knihovnu
 * odloží na `window`. Načte se jen jednou za život stránky.
 */
function nactiPdfJs(): Promise<any> {
  const okno = window as unknown as { __pdfjs?: any };
  if (okno.__pdfjs) return Promise.resolve(okno.__pdfjs);

  return new Promise((hotovo, chyba) => {
    const hlaska = 'preposlech-pdfjs';
    const posluchac = (e: Event) => {
      const detail = (e as CustomEvent<{ ok: boolean }>).detail;
      if (detail?.ok && okno.__pdfjs) hotovo(okno.__pdfjs);
      else chyba(new Error('pdf.js se nepodařilo načíst'));
    };
    window.addEventListener(hlaska, posluchac, { once: true });

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

export function Preposlech({
  caflouProjectId,
  projectName,
  pocatecniStav,
}: {
  caflouProjectId: string;
  projectName: string;
  pocatecniStav: Stav;
}) {
  const [stav, setStav] = useState<Stav>(pocatecniStav);
  const [stopy, setStopy] = useState<Stopa[]>([]);
  const [aktivniStopa, setAktivniStopa] = useState<number | null>(null);
  const [hraje, setHraje] = useState(false);
  const [pozice, setPozice] = useState(0);
  const [delka, setDelka] = useState(0);
  const [formOtevreny, setFormOtevreny] = useState(false);
  const [popis, setPopis] = useState('');
  const [zachyt, setZachyt] = useState<{ trackIndex: number; trackName: string; localTime: number; pdfPage: number | null } | null>(null);
  const [uklada, setUklada] = useState(false);
  const [chybaHlaska, setChybaHlaska] = useState<string | null>(null);

  // PDF
  const [pdfNazev, setPdfNazev] = useState('');
  const [pdfStran, setPdfStran] = useState(0);
  const [pdfStrana, setPdfStrana] = useState(1);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const zdrojRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const zacatekCtxRef = useRef(0);
  const offsetRef = useRef(0);
  const hrajeRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const stopyRef = useRef<Stopa[]>([]);
  const aktivniRef = useRef<number | null>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfObalRef = useRef<HTMLDivElement | null>(null);
  const ekvalizerRef = useRef<HTMLCanvasElement | null>(null);
  const popisRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    stopyRef.current = stopy;
  }, [stopy]);
  useEffect(() => {
    aktivniRef.current = aktivniStopa;
  }, [aktivniStopa]);

  function ctx(): AudioContext {
    if (!ctxRef.current) {
      const W = window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      ctxRef.current = new (W.AudioContext || W.webkitAudioContext!)();
    }
    return ctxRef.current;
  }

  function analyser(): AnalyserNode {
    const c = ctx();
    if (!analyserRef.current) {
      const a = c.createAnalyser();
      a.fftSize = 64;
      a.smoothingTimeConstant = 0.75;
      a.connect(c.destination);
      analyserRef.current = a;
    }
    return analyserRef.current;
  }

  const aktualniCas = useCallback(() => {
    if (!bufferRef.current) return 0;
    if (hrajeRef.current && ctxRef.current) {
      return Math.min(
        bufferRef.current.duration,
        offsetRef.current + (ctxRef.current.currentTime - zacatekCtxRef.current),
      );
    }
    return offsetRef.current;
  }, []);

  function zastavZdroj() {
    const z = zdrojRef.current;
    if (!z) return;
    z.onended = null;
    try {
      z.stop();
    } catch {
      // uz skoncil sam
    }
    z.disconnect();
    zdrojRef.current = null;
  }

  const pauza = useCallback(() => {
    if (!hrajeRef.current) return;
    offsetRef.current = aktualniCas();
    zastavZdroj();
    hrajeRef.current = false;
    setHraje(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [aktualniCas]);

  /** Vykreslí waveformu jedné stopy i se značkami chyb a pozicí přehrávání. */
  const kresliStopu = useCallback(
    (index: number) => {
      const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-stopa="${index}"]`);
      const stopa = stopyRef.current[index];
      if (!canvas || !stopa?.peaks) return;

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
      const trvani = stopa.audioBuffer?.duration || 1;
      const kurzor = jeAktivni ? (aktualniCas() / trvani) * w : -1;

      const sirkaSloupce = w / stopa.peaks.length;
      for (let i = 0; i < stopa.peaks.length; i += 1) {
        const [mn, mx] = stopa.peaks[i];
        const x = i * sirkaSloupce;
        c.fillStyle = jeAktivni && x < kurzor ? '#7B55FF' : '#a29c8f';
        c.fillRect(x, stred - mx * stred, Math.max(1, sirkaSloupce - 0.4), Math.max(1, (mx - mn) * stred));
      }

      // Znacky chyb - podle poradi stopy, ne podle nejakeho ID.
      c.fillStyle = '#c0432f';
      stav.chyby
        .filter((ch) => ch.trackIndex === index + 1)
        .forEach((ch) => {
          c.fillRect(Math.max(0, (ch.localTime / trvani) * w - 1.5), 0, 3, h);
        });

      if (jeAktivni && kurzor >= 0) c.fillRect(Math.max(0, kurzor - 0.5), 0, 1, h);
      c.restore();
    },
    [aktualniCas, stav.chyby],
  );

  const kresliVse = useCallback(() => {
    stopyRef.current.forEach((_, i) => kresliStopu(i));
  }, [kresliStopu]);

  /** Ekvalizér je ozdoba — bere data z právě hrající stopy, v klidu leží. */
  const kresliEkvalizer = useCallback(() => {
    const canvas = ekvalizerRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 150;
    const h = canvas.clientHeight || 38;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const c = canvas.getContext('2d');
    if (!c) return;
    c.save();
    c.scale(dpr, dpr);
    c.clearRect(0, 0, w, h);

    const pocet = 20;
    const mezera = 2;
    const sirka = Math.max(1, (w - mezera * (pocet - 1)) / pocet);

    if (analyserRef.current && hrajeRef.current) {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      const krok = Math.max(1, Math.floor(data.length / pocet));
      for (let i = 0; i < pocet; i += 1) {
        const v = data[Math.min(data.length - 1, i * krok)] / 255;
        const vyska = Math.max(2, v * h);
        c.fillStyle = v > 0.72 ? '#1FDF67' : '#7B55FF';
        c.fillRect(i * (sirka + mezera), h - vyska, sirka, vyska);
      }
    } else {
      c.fillStyle = '#c7c2b7';
      for (let i = 0; i < pocet; i += 1) c.fillRect(i * (sirka + mezera), h - 3, sirka, 3);
    }
    c.restore();
  }, []);

  const tik = useCallback(() => {
    setPozice(aktualniCas());
    if (aktivniRef.current !== null) kresliStopu(aktivniRef.current);
    kresliEkvalizer();
    if (hrajeRef.current) rafRef.current = requestAnimationFrame(tik);
  }, [aktualniCas, kresliEkvalizer, kresliStopu]);

  const prehrajOd = useCallback(
    (odkud: number) => {
      const buffer = bufferRef.current;
      if (!buffer) return;
      const c = ctx();
      zastavZdroj();
      const zdroj = c.createBufferSource();
      zdroj.buffer = buffer;
      zdroj.connect(analyser());
      const bezpecny = Math.max(0, Math.min(odkud, Math.max(0, buffer.duration - 0.02)));
      zdroj.start(0, bezpecny);
      zdroj.onended = () => {
        if (zdrojRef.current !== zdroj) return; // mezitim se preplo jinam
        hrajeRef.current = false;
        offsetRef.current = buffer.duration;
        setHraje(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        kresliEkvalizer();
      };
      zdrojRef.current = zdroj;
      zacatekCtxRef.current = c.currentTime;
      offsetRef.current = bezpecny;
      hrajeRef.current = true;
      setHraje(true);
      tik();
    },
    [kresliEkvalizer, tik],
  );

  const skoc = useCallback(
    (kam: number) => {
      const buffer = bufferRef.current;
      if (!buffer) return;
      const cil = Math.max(0, Math.min(kam, buffer.duration));
      if (hrajeRef.current) prehrajOd(cil);
      else {
        offsetRef.current = cil;
        setPozice(cil);
        if (aktivniRef.current !== null) kresliStopu(aktivniRef.current);
      }
    },
    [kresliStopu, prehrajOd],
  );

  function prehrajNeboPauzni() {
    if (!bufferRef.current) return;
    if (hrajeRef.current) {
      pauza();
      kresliEkvalizer();
    } else {
      void ctx().resume();
      prehrajOd(offsetRef.current >= bufferRef.current.duration - 0.02 ? 0 : offsetRef.current);
    }
  }

  /** Vybere stopu (a případně na ní rovnou skočí na čas). */
  const vyberStopu = useCallback(
    async (index: number, skocNa?: number) => {
      const stopa = stopyRef.current[index];
      if (!stopa) return;
      pauza();
      setAktivniStopa(index);
      aktivniRef.current = index;

      try {
        if (!stopa.audioBuffer) {
          const data = await stopa.file.arrayBuffer();
          const buffer = await ctx().decodeAudioData(data);
          stopa.audioBuffer = buffer;
          stopa.peaks = spocitejPeaks(buffer);
          setStopy((s) => [...s]);
        }
        if (aktivniRef.current !== index) return; // clovek mezitim preplo jinam
        bufferRef.current = stopa.audioBuffer;
        offsetRef.current = typeof skocNa === 'number' ? Math.max(0, Math.min(skocNa, stopa.audioBuffer!.duration)) : 0;
        setDelka(stopa.audioBuffer!.duration);
        setPozice(offsetRef.current);
        kresliStopu(index);
      } catch {
        setChybaHlaska(`Stopu „${stopa.name}" se nepodařilo přečíst — je to opravdu zvukový soubor?`);
      }
    },
    [kresliStopu, pauza],
  );

  function pridejStopy(seznam: FileList) {
    const soubory = Array.from(seznam).sort((a, b) =>
      a.name.localeCompare(b.name, 'cs', { numeric: true }),
    );
    setStopy((soucasne) => {
      const dalsi = [...soucasne];
      soubory.forEach((file, i) => {
        dalsi.push({ id: soucasne.length + i + 1, name: file.name, file, audioBuffer: null, peaks: null });
      });
      stopyRef.current = dalsi;
      return dalsi;
    });
    // Prvni nactena stopa se rovnou vybere, at neni potreba klikat navic.
    if (aktivniRef.current === null && soubory.length > 0) {
      setTimeout(() => void vyberStopu(0), 0);
    } else {
      setTimeout(() => kresliVse(), 0);
    }
  }

  /** Dekóduje stopy na pozadí, aby se waveformy objevily samy. */
  useEffect(() => {
    let zruseno = false;
    (async () => {
      for (let i = 0; i < stopyRef.current.length; i += 1) {
        const stopa = stopyRef.current[i];
        if (stopa.audioBuffer || zruseno) continue;
        try {
          const data = await stopa.file.arrayBuffer();
          const buffer = await ctx().decodeAudioData(data);
          if (zruseno) return;
          stopa.audioBuffer = buffer;
          stopa.peaks = spocitejPeaks(buffer);
          setStopy((s) => [...s]);
          kresliStopu(i);
        } catch {
          // Nectitelnou stopu proste necham bez waveformy - nema smysl kvuli
          // jednomu souboru zastavit celou praci.
        }
      }
    })();
    return () => {
      zruseno = true;
    };
  }, [stopy.length, kresliStopu]);

  useEffect(() => {
    kresliVse();
    kresliEkvalizer();
  }, [kresliVse, kresliEkvalizer, stav.chyby]);

  useEffect(() => {
    const prekresli = () => {
      kresliVse();
      kresliEkvalizer();
    };
    window.addEventListener('resize', prekresli);
    return () => window.removeEventListener('resize', prekresli);
  }, [kresliVse, kresliEkvalizer]);

  /* ---------- PDF ---------- */

  async function nactiPdf(file: File) {
    try {
      const pdfjs = await nactiPdfJs();
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`;
      const data = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data }).promise;
      pdfDocRef.current = doc;
      setPdfNazev(file.name);
      setPdfStran(doc.numPages);
      setPdfStrana(1);
      await vykresliPdf(doc);
    } catch {
      setChybaHlaska(`PDF „${file.name}" se nepodařilo načíst.`);
    }
  }

  async function vykresliPdf(doc: any) {
    const obal = pdfObalRef.current;
    if (!obal) return;
    obal.innerHTML = '';
    const prvni = await doc.getPage(1);
    const sirkaPanelu = obal.clientWidth - 32;
    const zvetseni = Math.max(0.3, Math.min(4, sirkaPanelu / prvni.getViewport({ scale: 1 }).width));

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
      cislo.className =
        'absolute top-1.5 left-1.5 bg-ink/60 text-white text-[10px] font-heading rounded px-1.5 py-0.5';
      ramecek.appendChild(cislo);
      obal.appendChild(ramecek);
      await stranka.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
  }

  function naStranu(n: number) {
    if (!pdfDocRef.current) return;
    const cil = Math.min(Math.max(1, n), pdfStran);
    setPdfStrana(cil);
    pdfObalRef.current?.querySelector(`[data-strana="${cil}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const zaklad = `/api/projekty/${encodeURIComponent(caflouProjectId)}/preposlech`;

  function otevriForm() {
    if (aktivniStopa === null || !bufferRef.current) return;
    if (hrajeRef.current) pauza();
    const stopa = stopyRef.current[aktivniStopa];
    setZachyt({
      trackIndex: aktivniStopa + 1,
      trackName: stopa.name,
      localTime: aktualniCas(),
      pdfPage: pdfDocRef.current ? pdfStrana : null,
    });
    setPopis('');
    setFormOtevreny(true);
    setTimeout(() => popisRef.current?.focus(), 0);
  }

  async function ulozChybu() {
    if (!zachyt || !popis.trim() || uklada) return;
    setUklada(true);
    const ok = await posli(zaklad, {
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
    await posli(`${zaklad}?chyba=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function prepniPreposlechnuto() {
    await posli(zaklad, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: !stav.reviewed }),
    });
  }

  /** Skok na chybu: přepne stopu, najede na čas a otočí PDF na stránku. */
  function skocNaChybu(ch: ChybaZeServeru) {
    const index = ch.trackIndex - 1;
    if (stopyRef.current[index]) {
      if (index !== aktivniRef.current) void vyberStopu(index, ch.localTime);
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
        skoc(aktualniCas() + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skoc(aktualniCas() - 5);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        otevriForm();
      }
    }
    window.addEventListener('keydown', stisk);
    return () => window.removeEventListener('keydown', stisk);
  });

  /** Stopa, na kterou záznam ukazuje, ale zrovna není načtená. */
  const chybejiciStopy = useMemo(() => {
    const nactene = new Set(stopy.map((_, i) => i + 1));
    return stav.chyby.some((ch) => !nactene.has(ch.trackIndex));
  }, [stav.chyby, stopy]);

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

  return (
    <div className="flex flex-col gap-4">
      {/* Lišta: stav přeposlechu a počty. Fialová jako všude v portálu. */}
      <div className="bg-brand-purple text-white rounded-card px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">AudioTagger</h2>
          <p className="text-xs font-body text-white/80 m-0 mt-0.5 truncate">{projectName}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-heading text-white/80">
            Stop: <b className="text-white">{stopy.length}</b> · Chyb:{' '}
            <b className="text-white">{stav.chyby.length}</b> · PDF:{' '}
            <b className="text-white">{pdfNazev || '—'}</b>
          </span>
          <span className="text-[11px] font-heading text-white/60 hidden lg:inline">
            Mezerník = přehrát · ←/→ = ±5 s · E = přidat chybu
          </span>
          <button
            type="button"
            onClick={prepniPreposlechnuto}
            className={`font-heading font-semibold text-xs rounded-lg px-3 py-1.5 transition-colors ${
              stav.reviewed
                ? 'bg-brand-green text-onAccent'
                : 'border border-white/40 text-white hover:border-white'
            }`}
          >
            {stav.reviewed ? '☑ Přeposlechnuto' : '☐ Přeposlechnuto'}
          </button>
        </div>
      </div>

      {stav.reviewed && stav.reviewedByName && (
        <p className="text-xs font-body text-muted m-0">
          Přeposlech potvrdil {stav.reviewedByName}
          {stav.reviewedAt ? ` · ${new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(stav.reviewedAt))}` : ''}
        </p>
      )}

      {chybaHlaska && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{chybaHlaska}</p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-4 items-start">
        {/* VLEVO: text nahrávky */}
        <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b border-line">
            <label className="flex items-center gap-2 text-sm font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1.5 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
              Načíst PDF s textem
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void nactiPdf(f);
                  e.target.value = '';
                }}
              />
            </label>
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
          <div
            ref={pdfObalRef}
            className="bg-field overflow-y-auto p-4 flex flex-col items-center gap-4"
            style={{ height: '72vh' }}
          >
            {pdfStran === 0 && (
              <p className="text-sm font-body text-muted m-auto text-center max-w-[280px]">
                Načtěte PDF s textem nahrávky. Stránka se bude přepínat spolu s chybami, které označíte vpravo.
              </p>
            )}
          </div>
        </div>

        {/* VPRAVO: chyby nahoře, ovládání uprostřed, stopy dole */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Záznamy chyb ({stav.chyby.length})
              </h3>
              {chybejiciStopy && (
                <span className="text-[11px] font-body text-status-progress">
                  Některé záznamy patří stopám, které teď nejsou načtené.
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
                      <button
                        type="button"
                        onClick={() => skocNaChybu(ch)}
                        className="flex-1 min-w-0 text-left"
                        title="Skočit na místo v nahrávce"
                      >
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-heading font-semibold tabular-nums bg-field border border-line rounded px-1.5">
                            {pad2(ch.trackIndex)}
                          </span>
                          <span className="text-xs font-heading text-muted tabular-nums">{cas(ch.localTime)}</span>
                          {ch.pdfPage && (
                            <span className="text-xs font-heading text-muted tabular-nums">s. {ch.pdfPage}</span>
                          )}
                          <span className="text-[11px] font-heading text-muted/70 tabular-nums">
                            Cubase {hms((ch.trackIndex - 1) * DELKA_STOPY_V_CUBASE + ch.localTime)}
                          </span>
                        </span>
                        <span className="block text-sm font-body text-ink mt-0.5 break-words">{ch.description}</span>
                        {ch.createdByName && (
                          <span className="block text-[11px] font-body text-muted mt-0.5">{ch.createdByName}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void smazChybu(ch.id)}
                        title="Smazat záznam"
                        className="text-muted hover:text-danger text-sm shrink-0"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Ovládání */}
          <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={prehrajNeboPauzni}
                disabled={aktivniStopa === null}
                title="Přehrát / pozastavit (mezerník)"
                className="w-10 h-10 rounded-full bg-brand-green text-onAccent font-heading font-bold disabled:opacity-40"
              >
                {hraje ? '❚❚' : '▶'}
              </button>
              <span className="text-xs font-heading font-semibold bg-tint text-brand-purpleDark rounded px-2 py-1 tabular-nums">
                {aktivniStopa === null ? '—' : `Stopa ${pad2(aktivniStopa + 1)}`}
              </span>
              <span className="text-sm font-heading text-muted tabular-nums">
                <b className="text-ink">{cas(pozice)}</b> / {cas(delka)}
              </span>
              <canvas ref={ekvalizerRef} className="w-[120px] h-[34px] block" />
              <button
                type="button"
                onClick={otevriForm}
                disabled={aktivniStopa === null || formOtevreny}
                className="ml-auto bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
              >
                + Přidat chybu
              </button>
            </div>
            {aktivniStopa !== null && (
              <p className="text-[11px] font-heading text-muted m-0 tabular-nums">
                Offset této stopy v Cubase: +{hms(aktivniStopa * DELKA_STOPY_V_CUBASE)}
              </p>
            )}

            {formOtevreny && zachyt && (
              <div className="border border-brand-purple bg-tint rounded-lg p-3 flex flex-col gap-2">
                <p className="text-xs font-heading text-muted m-0">
                  Stopa <b className="text-ink">{pad2(zachyt.trackIndex)}</b> · čas{' '}
                  <b className="text-ink tabular-nums">{cas(zachyt.localTime)}</b> · strana{' '}
                  <b className="text-ink">{zachyt.pdfPage ?? '— (PDF nenačteno)'}</b>
                </p>
                <textarea
                  ref={popisRef}
                  value={popis}
                  onChange={(e) => setPopis(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter uklada, Shift+Enter dela novy radek - stejne jako
                    // v prototypu, at se zaznamy pisou rychle.
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
                  <button
                    type="button"
                    onClick={() => setFormOtevreny(false)}
                    className="text-sm font-heading text-muted hover:text-ink"
                  >
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

          {/* Stopy */}
          <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Zvukové stopy
              </h3>
              <label className="flex items-center gap-2 text-xs font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1.5 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
                + Přidat stopy
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) pridejStopy(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="p-3 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '34vh' }}>
              {stopy.length === 0 ? (
                <p className="text-sm font-body text-muted m-0 px-1 py-5 text-center">
                  Načtěte zvukové stopy. Každou uvidíte i s vykreslenou křivkou — kliknutím do ní se
                  přesunete, kliknutím na značku skočíte na chybu.
                </p>
              ) : (
                stopy.map((stopa, index) => (
                  <div
                    key={stopa.id}
                    className={`rounded-lg border overflow-hidden ${
                      index === aktivniStopa ? 'border-brand-purple bg-tint' : 'border-line bg-surface'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void vyberStopu(index)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
                    >
                      <span className="text-[11px] font-heading font-bold tabular-nums bg-field rounded px-1.5 py-0.5">
                        {pad2(index + 1)}
                      </span>
                      <span className="flex-1 min-w-0 text-xs font-body text-ink truncate">{stopa.name}</span>
                      <span className="text-[10px] font-heading text-muted tabular-nums">
                        +{hms(index * DELKA_STOPY_V_CUBASE)}
                      </span>
                    </button>
                    <canvas
                      data-stopa={index}
                      className="w-full h-[56px] block bg-field cursor-pointer"
                      onClick={(e) => {
                        const stopaData = stopyRef.current[index];
                        if (!stopaData?.audioBuffer) {
                          void vyberStopu(index);
                          return;
                        }
                        const ramecek = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - ramecek.left;
                        const trvani = stopaData.audioBuffer.duration;
                        // Kliknuti na znacku skoci na chybu, jinak se jen presune.
                        const trefa = stav.chyby.find(
                          (ch) =>
                            ch.trackIndex === index + 1 &&
                            Math.abs((ch.localTime / trvani) * ramecek.width - x) < 6,
                        );
                        if (trefa) {
                          skocNaChybu(trefa);
                          return;
                        }
                        const kam = (x / ramecek.width) * trvani;
                        if (index === aktivniStopa) skoc(kam);
                        else void vyberStopu(index, kam);
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
