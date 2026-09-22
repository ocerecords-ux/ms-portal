'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ROZDĚLENÉ OKNO (zadání 22. 9. 2026: „dobrá možnost rozdělit okno portálu
 * tak, abych mohl dělat dvě různé věci. Tzn. vlevo si otevřu nabídku a napravo
 * projekty. Abych nemusel proklikávat tam a zpět").
 *
 * Vpravo je druhý portál ve vloženém okně (iframe) - má vlastní navigaci,
 * takže v každé půlce jde klikat nezávisle. Uvnitř pravé půlky se schová
 * lišta a doky (viz SKRIPT_MOTIVU → data-v-panelu a globals.css), ať tam je
 * jen obsah. Šířku jde táhnout za předěl; zapnutí, šířka i stránka vpravo se
 * pamatují v prohlížeči.
 *
 * Zapíná se ikonou v horní liště (událost „portal-rozdeleni"). Na telefonu
 * se nenabízí - na to je displej malý.
 */

const KLIC = 'ms-rozdeleni';
const RYCHLE: { label: string; cesta: string }[] = [
  { label: 'Projekty', cesta: '/projekty' },
  { label: 'Nabídky', cesta: '/admin/doklady/nabidky' },
  { label: 'Faktury', cesta: '/admin/doklady/faktury' },
  { label: 'Kalendář', cesta: '/kalendar' },
  { label: 'Výkazy', cesta: '/vykazy' },
];

type Stav = { zapnuto: boolean; sirka: number; cesta: string };
const VYCHOZI: Stav = { zapnuto: false, sirka: 45, cesta: '/projekty' };

function nacti(): Stav {
  try {
    const s = JSON.parse(window.localStorage.getItem(KLIC) || 'null');
    if (s && typeof s === 'object') return { ...VYCHOZI, ...s };
  } catch {
    // úložiště nejde - jede se s výchozím
  }
  return VYCHOZI;
}

export function RozdeleneOkno({ children }: { children: React.ReactNode }) {
  const [stav, setStav] = useState<Stav>(VYCHOZI);
  const [vPanelu, setVPanelu] = useState(false);
  const [tahne, setTahne] = useState(false);
  const ramec = useRef<HTMLIFrameElement | null>(null);
  const obal = useRef<HTMLDivElement | null>(null);

  const uloz = useCallback((dalsi: Partial<Stav>) => {
    setStav((p) => {
      const s = { ...p, ...dalsi };
      try {
        window.localStorage.setItem(KLIC, JSON.stringify(s));
      } catch {
        // nevadí
      }
      return s;
    });
  }, []);

  useEffect(() => {
    const jePanel = window.self !== window.top;
    setVPanelu(jePanel);
    if (jePanel) return;
    setStav(nacti());
    const prepni = () => setStav((p) => {
      const s = { ...p, zapnuto: !p.zapnuto };
      try {
        window.localStorage.setItem(KLIC, JSON.stringify(s));
      } catch {
        // nevadí
      }
      return s;
    });
    window.addEventListener('portal-rozdeleni', prepni);
    return () => window.removeEventListener('portal-rozdeleni', prepni);
  }, []);

  // Tažení předělu.
  useEffect(() => {
    if (!tahne) return;
    const pohyb = (e: PointerEvent) => {
      const r = obal.current?.getBoundingClientRect();
      if (!r) return;
      const vpravo = ((r.right - e.clientX) / r.width) * 100;
      uloz({ sirka: Math.min(75, Math.max(25, vpravo)) });
    };
    const konec = () => setTahne(false);
    window.addEventListener('pointermove', pohyb);
    window.addEventListener('pointerup', konec);
    return () => {
      window.removeEventListener('pointermove', pohyb);
      window.removeEventListener('pointerup', konec);
    };
  }, [tahne, uloz]);

  if (vPanelu || !stav.zapnuto) return <>{children}</>;

  /** Po každém prokliku vpravo si zapamatovat, kde to je. */
  const poNacteni = () => {
    try {
      const loc = ramec.current?.contentWindow?.location;
      if (loc && loc.origin === window.location.origin) {
        const cesta = loc.pathname + loc.search;
        if (cesta !== stav.cesta) uloz({ cesta });
      }
    } catch {
      // jiná doména - nic
    }
  };

  const otevri = (cesta: string) => {
    uloz({ cesta });
    if (ramec.current) ramec.current.src = cesta;
  };

  return (
    <div ref={obal} className="flex items-start gap-0 min-w-0">
      <div className="min-w-0 flex-1 pr-3" style={{ width: `${100 - stav.sirka}%` }}>
        {children}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        title="Táhnutím změníte šířku"
        onPointerDown={(e) => {
          e.preventDefault();
          setTahne(true);
        }}
        className="hidden md:block sticky top-[92px] self-start w-2 h-[calc(100vh-104px)] cursor-col-resize rounded-full bg-line hover:bg-brand-purple/50 shrink-0"
      />
      <div
        className="hidden md:flex sticky top-[92px] self-start flex-col h-[calc(100vh-104px)] shrink-0 pl-3"
        style={{ width: `${stav.sirka}%` }}
      >
        <div className="flex items-center gap-1.5 flex-wrap pb-2">
          {RYCHLE.map((r) => (
            <button
              key={r.cesta}
              type="button"
              onClick={() => otevri(r.cesta)}
              className={`rounded-pill border px-2.5 py-1 text-xs font-heading font-semibold transition-colors ${
                stav.cesta.startsWith(r.cesta) ? 'border-brand-purple text-brand-purple bg-brand-purple/10' : 'border-line text-muted hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => ramec.current?.contentWindow?.history.back()}
            title="Zpět"
            className="w-7 h-7 rounded-lg border border-line text-muted hover:text-ink"
          >
            ‹
          </button>
          <a
            href={stav.cesta}
            title="Otevřít vlevo místo téhle stránky"
            className="h-7 px-2 inline-flex items-center rounded-lg border border-line text-xs font-heading text-muted hover:text-ink no-underline"
          >
            Otevřít vlevo
          </a>
          <button
            type="button"
            onClick={() => uloz({ zapnuto: false })}
            title="Zavřít rozdělení"
            aria-label="Zavřít rozdělení"
            className="w-7 h-7 rounded-lg border border-line text-muted hover:text-danger text-base leading-none"
          >
            ×
          </button>
        </div>
        <iframe
          ref={ramec}
          src={stav.cesta}
          onLoad={poNacteni}
          title="Druhá půlka portálu"
          className={`flex-1 w-full rounded-card border border-line bg-paper ${tahne ? 'pointer-events-none' : ''}`}
        />
      </div>
    </div>
  );
}

/** Tlačítko do horní lišty. */
export function TlacitkoRozdeleni() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('portal-rozdeleni'))}
      title="Rozdělit okno - vpravo druhá stránka portálu"
      aria-label="Rozdělit okno"
      className="hidden md:flex items-center justify-center w-9 h-9 rounded-pill text-white/80 hover:text-white hover:bg-white/10 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M12 4v16" />
      </svg>
    </button>
  );
}
