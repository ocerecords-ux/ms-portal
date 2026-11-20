'use client';

import { useEffect, useRef, useState } from 'react';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import type { CenikProDoklad } from '@/lib/cenikProDokladServer';
import { formatMoney } from '@/lib/doklady';
import type { Currency } from '@prisma/client';

/**
 * POLOŽKA Z CENÍKU DO DOKLADU (zadání 19. 11. 2026: „u dokladů - nabídky
 * a faktury bych chtěl mít možnost přidat položky z ceníku").
 *
 * Ceník studia je hotový seznam služeb i s cenami; tohle je nabídka, ze které
 * se jedním klepnutím vloží řádek. Cena se předvyplní a dá se přepsat -
 * u položek vedených jako „od" je to beztak jen orientační číslo.
 *
 * NABÍZÍ SE JEN CENÍK VE STEJNÉ MĚNĚ, jakou má doklad. Přepočítávat kurzem
 * by znamenalo napsat do nabídky číslo, které v ceníku nikde nestojí.
 *
 * Ceník se načítá až při prvním otevření - většina dokladů ho nepotřebuje.
 */
export function VyberZCeniku({
  mena,
  onVlozit,
  maly = false,
}: {
  mena: Currency;
  onVlozit: (popis: string, cenaMinor: number) => void;
  /** Malé „+" přímo u řádku položky (zadání 20. 11. 2026). */
  maly?: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [otevreno, setOtevreno] = useState(false);
  const [ceniky, setCeniky] = useState<CenikProDoklad[] | null>(null);
  const obal = useRef<HTMLSpanElement | null>(null);

  // Zavrit kliknutim jinam nebo Escapem - stejne jako panely v kalendari.
  useEffect(() => {
    if (!otevreno) return;
    const mimo = (e: MouseEvent) => {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtevreno(false);
    };
    document.addEventListener('mousedown', mimo);
    document.addEventListener('keydown', klavesa);
    return () => {
      document.removeEventListener('mousedown', mimo);
      document.removeEventListener('keydown', klavesa);
    };
  }, [otevreno]);

  async function otevri() {
    setOtevreno((p) => !p);
    if (ceniky !== null) return;
    const res = await fetch('/api/admin/doklady/cenik').catch(() => null);
    if (!res?.ok) {
      setCeniky([]);
      return;
    }
    const data = (await res.json().catch(() => null)) as { ceniky?: CenikProDoklad[] } | null;
    setCeniky(data?.ceniky ?? []);
  }

  const vMene = (ceniky ?? []).filter((c) => c.mena === mena);

  return (
    <span ref={obal} className="relative inline-flex">
      <button
        type="button"
        onClick={() => void otevri()}
        title={maly ? t('doklad.zCeniku') : undefined}
        aria-label={maly ? t('doklad.zCeniku') : undefined}
        className={
          maly
            ? 'shrink-0 text-muted hover:text-brand-purple text-lg font-heading leading-none px-1 bg-transparent border-0 cursor-pointer'
            : 'text-sm font-heading font-semibold rounded-lg px-3 py-2 border border-line text-ink hover:border-brand-purple'
        }
      >
        {maly ? '+' : t('doklad.zCeniku')}
      </button>

      {otevreno && (
        <span
          className={`absolute z-30 top-full mt-1 w-[360px] ${maly ? 'right-0' : 'left-0'} max-h-[340px] overflow-y-auto rounded-card border border-line bg-surface shadow-lg p-2 flex flex-col gap-1`}
        >
          {ceniky === null && (
            <span className="text-xs font-body text-muted px-2 py-1.5">{t('doklad.cenikNacitam')}</span>
          )}
          {ceniky !== null && vMene.length === 0 && (
            <span className="text-xs font-body text-muted px-2 py-1.5">
              {t('doklad.cenikProMenuNeni')}
            </span>
          )}
          {vMene.map((c) => (
            <span key={c.studioId} className="flex flex-col">
              <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted px-2 pt-2 pb-1">
                {c.studioNazev}
              </span>
              {c.polozky.map((p) => (
                <button
                  key={p.klic}
                  type="button"
                  onClick={() => {
                    onVlozit(p.popis, p.cenaMinor ?? 0);
                    setOtevreno(false);
                  }}
                  className="flex items-center gap-3 text-left rounded-lg px-2 py-1.5 bg-transparent border-0 cursor-pointer hover:bg-field"
                >
                  <span className="text-sm font-body text-ink grow min-w-0">{p.popis}</span>
                  <span className="text-sm font-heading text-muted tabular-nums shrink-0">
                    {p.od ? `${t('doklad.cenikOd')} ` : ''}
                    {formatMoney(p.cenaMinor ?? 0, mena, jazyk)}
                  </span>
                </button>
              ))}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
