'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * DVOJKLIK NA IKONU UKÁŽE NÁHLED (zadání 25. 9. 2026: „nastav, že když dvakrát
 * kliknu na ikony v přehledu projektů (ikona přeposlechu, nabídky nebo
 * faktury), tak se mi otevře daná věc"; upřesnění 26. 9. 2026: „u dokladu se
 * zobrazí náhled ve vyskakovacím okně. Ale ne celkový doklad, ale jen zásadní
 * informace typu cena, na koho byl doklad zaslán, datum splatnosti atd. a pak
 * tlačítko Otevřít doklad. U audiotaggeru bych to udělal podobně").
 *
 * PROČ NÁHLED A NE ROVNOU DOKLAD: z přehledu projektů se nejčastěji ptáme na
 * jednu věc - kolik a do kdy, nebo kolik stop ještě zbývá. Na to stačí šest
 * řádků a člověk se nemusí vracet zpátky. Kdo potřebuje víc, má v okně
 * tlačítko.
 *
 * Schválně DVOJklik a ne obyčejné kliknutí: ikony sedí v řádku projektu,
 * kterým se prochází a odklikávají jiné věci, a jedno kliknutí navíc by
 * z přehledu odskakovalo pokaždé, když někdo minul sousední tlačítko.
 */

export type DruhNahledu = 'NABIDKA' | 'FAKTURA' | 'PREPOSLECH';

type Radek = { popis: string; hodnota: string; duraz?: boolean; varovani?: boolean };
type Nahled = { nadpis: string; odkaz: string; tlacitko: string; radky: Radek[] };

function adresaNahledu(druh: DruhNahledu, id: string): string {
  if (druh === 'PREPOSLECH') return `/api/nahled/preposlech?projekt=${encodeURIComponent(id)}`;
  const d = druh === 'NABIDKA' ? 'nabidka' : 'faktura';
  return `/api/nahled/doklad?druh=${d}&id=${encodeURIComponent(id)}`;
}

export function DvojklikOtevri({
  odkaz,
  popis,
  druh,
  id,
  children,
}: {
  /** Kam vede tlačítko v okně (a kam se jde, když náhled nedorazí). */
  odkaz: string;
  /** Doplní se k bublince ikony, ať je poznat, že se dá otevřít. */
  popis: string;
  /** Co se má v okně ukázat. Bez toho se dvojklik chová postaru a rovnou otevře. */
  druh?: DruhNahledu;
  /** Id dokladu, u přeposlechu caflouProjectId. */
  id?: string | null;
  children: React.ReactNode;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const [data, setData] = useState<Nahled | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const otevri = useCallback(() => {
    // Bez druhu nebo bez id není co ukazovat - otevře se rovnou věc sama.
    if (!druh || !id) {
      window.open(odkaz, '_blank', 'noopener,noreferrer');
      return;
    }
    setOtevreno(true);
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
  }, [druh, id, odkaz, data]);

  // Escape zavírá - okno je jen náhled, nemá u sebe držet pozornost.
  useEffect(() => {
    if (!otevreno) return;
    const zavri = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtevreno(false);
    };
    window.addEventListener('keydown', zavri);
    return () => window.removeEventListener('keydown', zavri);
  }, [otevreno]);

  return (
    <>
      <span
        role="link"
        tabIndex={0}
        title={popis}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          otevri();
        }}
        onKeyDown={(e) => {
          // Klávesnicí stačí Enter - dvojklik se odmáčknout nedá.
          if (e.key === 'Enter') {
            e.preventDefault();
            otevri();
          }
        }}
        className="inline-flex cursor-pointer"
      >
        {children}
      </span>

      {otevreno && (
        <span
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOtevreno(false)}
          onDoubleClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <span
            className="block bg-surface border border-line rounded-card shadow-2xl w-full max-w-sm overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
              <span className="font-heading font-semibold text-sm text-ink truncate">
                {data?.nadpis ?? 'Náhled'}
              </span>
              <button
                type="button"
                onClick={() => setOtevreno(false)}
                aria-label="Zavřít"
                className="text-muted hover:text-ink text-xl leading-none bg-transparent border-0 cursor-pointer"
              >
                ×
              </button>
            </span>

            <span className="block p-4">
              {chyba && <span className="block text-sm font-body text-status-error">{chyba}</span>}
              {!chyba && !data && (
                <span className="block text-sm font-body text-muted">Načítám…</span>
              )}
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

              <span className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setOtevreno(false)}
                  className="text-sm font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
                >
                  Zavřít
                </button>
                <a
                  href={data?.odkaz ?? odkaz}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOtevreno(false)}
                  className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 no-underline"
                >
                  {data?.tlacitko ?? 'Otevřít'}
                </a>
              </span>
            </span>
          </span>
        </span>
      )}
    </>
  );
}
