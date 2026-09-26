'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nactiPdfJs, nastavPdfWorker } from '@/lib/pdfJs';
import { slozUpravenePdf, type StrankaUpravy } from '@/lib/pdfUpravy';
import { usePreklad } from '../components/JazykProvider';

/**
 * NÁHLED A ÚPRAVA PDF V OBJEDNÁVCE (zadání 22. 9. 2026: „když klient vloží
 * text do objednávky v PDF, bylo by dobré, kdyby se tam otevřel náhled a mohl
 * ho editovat a třeba mazat i jednotlivé stránky").
 *
 * Pod přílohou se ukážou náhledy stránek. U každé jde stránku vyřadit
 * (a zase vrátit) nebo otočit, kliknutím se otevře velká. Z toho, co zbude,
 * se v prohlížeči složí nové PDF - to se pak odešle a z něj se počítají
 * normostrany. Původní soubor zůstává u klienta, nic se nenahrává dřív.
 */

type Stav = { index: number; otoceni: number; vyrazena: boolean };

export function UpravaPdf({ soubor, onZmena }: { soubor: File; onZmena: (upraveny: File) => void }) {
  const t = usePreklad();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [doc, setDoc] = useState<any>(null);
  const [stranky, setStranky] = useState<Stav[]>([]);
  const [chyba, setChyba] = useState<string | null>(null);
  const [skladam, setSkladam] = useState(false);
  const [velka, setVelka] = useState<number | null>(null);
  const prvniSlozeni = useRef(true);

  // Načtení PDF.
  useEffect(() => {
    let zruseno = false;
    setDoc(null);
    setStranky([]);
    setChyba(null);
    setVelka(null);
    prvniSlozeni.current = true;
    (async () => {
      try {
        const pdfjs = await nactiPdfJs();
        await nastavPdfWorker(pdfjs);
        const d = await pdfjs.getDocument({ data: new Uint8Array(await soubor.arrayBuffer()) }).promise;
        if (zruseno) return;
        setDoc(d);
        setStranky(Array.from({ length: d.numPages }, (_, i) => ({ index: i, otoceni: 0, vyrazena: false })));
      } catch (err) {
        console.error('Náhled PDF se nepodařilo načíst:', err);
        if (!zruseno) setChyba(t('upravaPdf.chybaNahled'));
      }
    })();
    return () => {
      zruseno = true;
    };
  }, [soubor, t]);

  // Po každé změně se složí nové PDF (s malou prodlevou, ať se neskládá při každém ťuknutí).
  useEffect(() => {
    if (!doc || stranky.length === 0) return;
    if (prvniSlozeni.current) {
      prvniSlozeni.current = false;
      return;
    }
    const zbyle: StrankaUpravy[] = stranky.filter((s) => !s.vyrazena).map((s) => ({ index: s.index, otoceni: s.otoceni }));
    if (zbyle.length === 0) return;
    const casovac = setTimeout(async () => {
      setSkladam(true);
      setChyba(null);
      try {
        const bezZmen = zbyle.length === doc.numPages && zbyle.every((s, i) => s.index === i && s.otoceni === 0);
        onZmena(bezZmen ? soubor : await slozUpravenePdf(soubor, zbyle));
      } catch (err) {
        console.error('Upravené PDF se nepodařilo složit:', err);
        setChyba(t('upravaPdf.chybaUpravy'));
        onZmena(soubor);
      } finally {
        setSkladam(false);
      }
    }, 500);
    return () => clearTimeout(casovac);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stranky]);

  const prepni = (i: number) =>
    setStranky((p) => {
      const zbylo = p.filter((s) => !s.vyrazena).length;
      return p.map((s, j) => (j === i ? { ...s, vyrazena: s.vyrazena ? false : zbylo > 1 } : s));
    });
  const otoc = (i: number) => setStranky((p) => p.map((s, j) => (j === i ? { ...s, otoceni: (s.otoceni + 90) % 360 } : s)));

  // Klávesy ve velkém náhledu.
  useEffect(() => {
    if (velka === null) return;
    function klavesa(e: KeyboardEvent) {
      if (e.key === 'Escape') setVelka(null);
      if (e.key === 'ArrowRight') setVelka((v) => (v === null ? v : Math.min(stranky.length - 1, v + 1)));
      if (e.key === 'ArrowLeft') setVelka((v) => (v === null ? v : Math.max(0, v - 1)));
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setStranky((p) => {
          const zbylo = p.filter((s) => !s.vyrazena).length;
          return p.map((s, j) => (j === velka ? { ...s, vyrazena: s.vyrazena ? false : zbylo > 1 } : s));
        });
      }
    }
    window.addEventListener('keydown', klavesa);
    return () => window.removeEventListener('keydown', klavesa);
  }, [velka, stranky.length]);

  if (chyba && !doc) return <p className="m-0 mt-2 text-xs font-body text-white/70">{chyba}</p>;
  if (!doc) return <p className="m-0 mt-2 text-xs font-body text-white/70">{t('upravaPdf.pripravuji')}</p>;

  const vyrazenych = stranky.filter((s) => s.vyrazena).length;

  return (
    <div className="mt-3 rounded-lg border border-white/25 bg-white/5 p-3">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <p className="m-0 font-heading font-semibold text-sm text-white">{t('upravaPdf.nadpis')}</p>
        <span className="text-[11px] font-body text-white/65">
          {[
            t('upravaPdf.pocet', { zbylo: stranky.length - vyrazenych, celkem: doc.numPages }),
            vyrazenych > 0 ? t('upravaPdf.vyrazeno', { pocet: vyrazenych }) : null,
            skladam ? t('upravaPdf.ukladam') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {vyrazenych > 0 && (
          <button
            type="button"
            onClick={() => setStranky((p) => p.map((s) => ({ ...s, vyrazena: false })))}
            className="ml-auto text-[11px] font-heading font-semibold text-brand-green underline"
          >
            {t('upravaPdf.vratitVse')}
          </button>
        )}
      </div>
      <p className="m-0 mb-2 text-[11px] font-body text-white/60">{t('upravaPdf.napoveda')}</p>
      {chyba && <p className="m-0 mb-2 text-xs font-body text-white/80">{chyba}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 max-h-[420px] overflow-y-auto pr-1">
        {stranky.map((s, i) => (
          <div
            key={s.index}
            className={`relative rounded-md border ${s.vyrazena ? 'border-white/10 opacity-35' : 'border-white/25'} bg-white/10`}
          >
            <button type="button" onClick={() => setVelka(i)} className="block w-full p-1" title={t('upravaPdf.strana', { cislo: s.index + 1 })}>
              <NahledStranky doc={doc} cislo={s.index + 1} sirka={160} otoceni={s.otoceni} />
            </button>
            <span className="absolute left-1 bottom-1 rounded bg-black/60 px-1 text-[10px] font-heading text-white">
              {s.index + 1}
            </span>
            <div className="absolute right-1 top-1 flex gap-1">
              <button
                type="button"
                onClick={() => otoc(i)}
                title={t('upravaPdf.otocit90')}
                aria-label={t('upravaPdf.otocitStranu', { cislo: s.index + 1 })}
                className="w-6 h-6 rounded-full bg-black/60 text-white text-xs leading-none hover:bg-black/80"
              >
                ↻
              </button>
              <button
                type="button"
                onClick={() => prepni(i)}
                title={s.vyrazena ? t('upravaPdf.vratitStranku') : t('upravaPdf.vyraditStranku')}
                aria-label={
                  s.vyrazena
                    ? t('upravaPdf.vratitStranu', { cislo: s.index + 1 })
                    : t('upravaPdf.vyraditStranu', { cislo: s.index + 1 })
                }
                className={`w-6 h-6 rounded-full text-xs leading-none ${
                  s.vyrazena ? 'bg-brand-green text-brand-purpleDark' : 'bg-black/60 text-white hover:bg-red-600'
                }`}
              >
                {s.vyrazena ? '↺' : '×'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {velka !== null && stranky[velka] && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setVelka(null)}
          className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-brand-purpleDark rounded-card border border-white/20 shadow-lg max-w-[94vw] max-h-[94vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 text-white">
              <span className="font-heading font-semibold text-sm">
                {t('upravaPdf.velkaStrana', { cislo: stranky[velka].index + 1, celkem: doc.numPages })}
                {stranky[velka].vyrazena ? ` · ${t('upravaPdf.vyrazenaStitek')}` : ''}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setVelka((v) => (v === null ? v : Math.max(0, v - 1)))}
                disabled={velka === 0}
                className="w-9 h-9 rounded-lg border border-white/30 disabled:opacity-40"
                aria-label={t('upravaPdf.predchoziStrana')}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setVelka((v) => (v === null ? v : Math.min(stranky.length - 1, v + 1)))}
                disabled={velka === stranky.length - 1}
                className="w-9 h-9 rounded-lg border border-white/30 disabled:opacity-40"
                aria-label={t('upravaPdf.dalsiStrana')}
              >
                ›
              </button>
              <button type="button" onClick={() => otoc(velka)} className="h-9 px-3 rounded-lg border border-white/30 text-sm">
                {t('upravaPdf.otocit')}
              </button>
              <button
                type="button"
                onClick={() => prepni(velka)}
                className={`h-9 px-3 rounded-lg text-sm font-heading font-semibold ${
                  stranky[velka].vyrazena ? 'bg-brand-green text-brand-purpleDark' : 'bg-red-600 text-white'
                }`}
              >
                {stranky[velka].vyrazena ? t('upravaPdf.vratitStranku') : t('upravaPdf.vyraditStranku')}
              </button>
              <button
                type="button"
                onClick={() => setVelka(null)}
                className="w-9 h-9 rounded-lg border border-white/40 text-xl leading-none"
                aria-label={t('obecne.zavrit')}
              >
                ×
              </button>
            </div>
            <div className={`overflow-auto p-3 pt-0 ${stranky[velka].vyrazena ? 'opacity-40' : ''}`}>
              <NahledStranky doc={doc} cislo={stranky[velka].index + 1} sirka={900} otoceni={stranky[velka].otoceni} velky />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Vykreslí jednu stránku do <canvas> - až když je vidět (u dlouhých rukopisů). */
function NahledStranky({
  doc,
  cislo,
  sirka,
  otoceni,
  velky = false,
}: {
  doc: any;
  cislo: number;
  sirka: number;
  otoceni: number;
  velky?: boolean;
}) {
  const platno = useRef<HTMLCanvasElement | null>(null);
  const uloha = useRef<{ cancel: () => void } | null>(null);
  const [videt, setVidet] = useState(velky);

  useEffect(() => {
    if (velky || !platno.current) return;
    const el = platno.current;
    const pozorovatel = new IntersectionObserver(
      (zaznamy) => {
        if (zaznamy.some((z) => z.isIntersecting)) {
          setVidet(true);
          pozorovatel.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    pozorovatel.observe(el);
    return () => pozorovatel.disconnect();
  }, [velky]);

  const kresli = useCallback(async () => {
    const el = platno.current;
    if (!el) return;
    const stranka = await doc.getPage(cislo);
    const zaklad = stranka.getViewport({ scale: 1, rotation: (stranka.rotate + otoceni) % 360 });
    const pomer = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cilSirka = velky ? Math.min(sirka, window.innerWidth * 0.9) : sirka;
    const viewport = stranka.getViewport({ scale: (cilSirka / zaklad.width) * pomer, rotation: (stranka.rotate + otoceni) % 360 });
    el.width = viewport.width;
    el.height = viewport.height;
    if (velky) {
      el.style.maxHeight = '80vh';
    }
    // Rozkreslená stránka se při otočení zruší - pdf.js nesnese dvě kreslení do jednoho plátna.
    uloha.current?.cancel();
    const u = stranka.render({ canvasContext: el.getContext('2d'), viewport });
    uloha.current = u;
    try {
      await u.promise;
    } catch (err) {
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') throw err;
    }
  }, [doc, cislo, sirka, otoceni, velky]);

  useEffect(() => {
    if (!videt) return;
    kresli().catch((err) => console.warn('Stránku PDF se nepodařilo vykreslit:', err));
  }, [videt, kresli]);

  return <canvas ref={platno} className={`block ${velky ? 'max-w-full h-auto mx-auto' : 'w-full h-auto'} bg-white rounded-sm`} />;
}
