'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * NÁHLED POD IKONOU V PŘEHLEDU PROJEKTŮ (zadání 25. 9. 2026: „když kliknu na
 * ikony v přehledu projektů (ikona přeposlechu, nabídky nebo faktury), tak se
 * mi otevře daná věc"; 26. 9. 2026: „u dokladu se zobrazí náhled ve
 * vyskakovacím okně. Ale ne celkový doklad, ale jen zásadní informace typu
 * cena, na koho byl doklad zaslán, datum splatnosti atd. a pak tlačítko
 * Otevřít doklad"; upřesnění téhož dne: „bude stačit jeden klik na tu ikonu
 * a to vyskakovací okno se otevře rovnou u toho a bez zamlžení přehledu
 * projektu a dáme pryč křížek na zavření. Zavřeme to dalším klikem na to
 * vyskočené okno kdekoli v okně (kromě tlačítka Otevřít)").
 *
 * JEDEN KLIK, OKNO U IKONY, ŽÁDNÉ ZTMAVENÍ. Náhled je jen nakouknutí -
 * přehled projektů má pod ním zůstat čitelný, aby bylo vidět, u kterého
 * řádku člověk stojí. Proto se okno kotví k ikoně a nic nepřekrývá.
 *
 * ZAVÍRÁ SE KLIKEM KAMKOLIV DO OKNA. Křížek by na tak malé ploše jen zabíral
 * místo; kdo si přečetl, co potřeboval, klepne a je pryč. Escape a klik mimo
 * fungují taky - a posun stránky okno zavře, ať nezůstane viset vedle jiného
 * řádku, než ke kterému patří.
 */

export type DruhNahledu = 'NABIDKA' | 'FAKTURA' | 'PREPOSLECH';

type Radek = { popis: string; hodnota: string; duraz?: boolean; varovani?: boolean };
type Nahled = { nadpis: string; odkaz: string; tlacitko: string; radky: Radek[] };

/** Šířka okna; drží se i při počítání, aby nevylezlo z obrazovky. */
const SIRKA = 300;
const MEZERA = 8;

function adresaNahledu(druh: DruhNahledu, id: string): string {
  if (druh === 'PREPOSLECH') return `/api/nahled/preposlech?projekt=${encodeURIComponent(id)}`;
  const d = druh === 'NABIDKA' ? 'nabidka' : 'faktura';
  return `/api/nahled/doklad?druh=${d}&id=${encodeURIComponent(id)}`;
}

export function NahledIkony({
  odkaz,
  popis,
  druh,
  id,
  children,
}: {
  /** Kam vede tlačítko v okně (a kam se jde, když náhled není z čeho složit). */
  odkaz: string;
  /** Bublinka u ikony. */
  popis: string;
  /** Co se má v okně ukázat. Bez toho se klik chová postaru a rovnou otevře. */
  druh?: DruhNahledu;
  /** Id dokladu, u přeposlechu caflouProjectId. */
  id?: string | null;
  children: React.ReactNode;
}) {
  const [kotva, setKotva] = useState<{ left: number; top: number } | null>(null);
  const [data, setData] = useState<Nahled | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const oknoRef = useRef<HTMLSpanElement | null>(null);

  const otevri = useCallback(
    (prvek: HTMLElement) => {
      if (!druh || !id) {
        window.open(odkaz, '_blank', 'noopener,noreferrer');
        return;
      }
      const r = prvek.getBoundingClientRect();
      setKotva({
        left: Math.min(r.left, window.innerWidth - SIRKA - MEZERA),
        top: r.bottom + MEZERA,
      });
      setChyba(null);
      if (data) return;
      void (async () => {
        try {
          const res = await fetch(adresaNahledu(druh, id));
          const o = await res.json().catch(() => ({}));
          if (!res.ok) {
            setChyba(o?.error || 'Náhled se nepodařilo načíst.');
            return;
          }
          setData(o as Nahled);
        } catch {
          setChyba('Náhled se nepodařilo načíst.');
        }
      })();
    },
    [druh, id, odkaz, data],
  );

  /** Okno se nesmí schovat pod spodní hranou - když se nevejde, jde nad ikonu. */
  useLayoutEffect(() => {
    if (!kotva || !oknoRef.current) return;
    const r = oknoRef.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - MEZERA) {
      const novy = Math.max(MEZERA, window.innerHeight - r.height - MEZERA);
      if (Math.abs(novy - kotva.top) > 1) setKotva({ ...kotva, top: novy });
    }
  }, [kotva, data]);

  // Escape, klik mimo a posun stránky okno zavřou.
  useEffect(() => {
    if (!kotva) return;
    const zavri = () => setKotva(null);
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKotva(null);
    };
    const mimo = (e: MouseEvent) => {
      if (oknoRef.current && !oknoRef.current.contains(e.target as Node)) setKotva(null);
    };
    window.addEventListener('keydown', klavesa);
    window.addEventListener('scroll', zavri, true);
    window.addEventListener('resize', zavri);
    // Až v dalším cyklu, ať otevírací klik okno rovnou nezavře.
    const t = window.setTimeout(() => document.addEventListener('mousedown', mimo), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('scroll', zavri, true);
      window.removeEventListener('resize', zavri);
      document.removeEventListener('mousedown', mimo);
    };
  }, [kotva]);

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        title={popis}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          otevri(e.currentTarget as HTMLElement);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            otevri(e.currentTarget as HTMLElement);
          }
        }}
        className="inline-flex cursor-pointer"
      >
        {children}
      </span>

      {kotva && (
        <span
          ref={oknoRef}
          // Klik kamkoliv do okna ho zavře (26. 9. 2026) - kromě tlačítka níž.
          onClick={() => setKotva(null)}
          style={{ position: 'fixed', left: kotva.left, top: kotva.top, width: SIRKA }}
          className="z-[90] block bg-surface border border-line rounded-card shadow-2xl overflow-hidden text-left cursor-pointer"
        >
          <span className="block px-4 py-2.5 border-b border-line font-heading font-semibold text-sm text-ink truncate">
            {data?.nadpis ?? 'Náhled'}
          </span>

          <span className="block p-4">
            {chyba && <span className="block text-sm font-body text-status-error">{chyba}</span>}
            {!chyba && !data && <span className="block text-sm font-body text-muted">Načítám…</span>}
            {data && (
              <span className="flex flex-col gap-1.5">
                {data.radky.map((r) => (
                  <span key={r.popis} className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-heading text-muted shrink-0">{r.popis}</span>
                    <span
                      className={`text-right font-body ${
                        r.varovani
                          ? 'text-status-error font-heading text-sm'
                          : r.duraz
                            ? 'text-ink font-heading text-base'
                            : 'text-ink text-sm'
                      }`}
                    >
                      {r.hodnota}
                    </span>
                  </span>
                ))}
              </span>
            )}

            <span className="flex items-center justify-end pt-4">
              <a
                href={data?.odkaz ?? odkaz}
                target="_blank"
                rel="noopener noreferrer"
                // Tlačítko okno nezavírá tím, že je to klik do okna - otevře
                // a zavře se samo až potom.
                onClick={(e) => {
                  e.stopPropagation();
                  setKotva(null);
                }}
                className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 no-underline"
              >
                {data?.tlacitko ?? 'Otevřít'}
              </a>
            </span>
          </span>
        </span>
      )}
    </>
  );
}
