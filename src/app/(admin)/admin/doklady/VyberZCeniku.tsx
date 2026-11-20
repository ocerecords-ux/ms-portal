'use client';

import { useEffect, useRef, useState } from 'react';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import type { PolozkaCeniku } from '@/lib/cenikProDokladServer';
import { formatMoney } from '@/lib/doklady';
import type { Currency } from '@prisma/client';

/**
 * POLOŽKA Z CENÍKU PŘÍMO U ŘÁDKU DOKLADU (zadání 20. 11. 2026: „dejme někde
 * u toho řádku, kde píšu položku, + a já tam přidám položku, kterou mám
 * v ceníku - Výroba rádiového spotu").
 *
 * Malé „+" vedle popisu rozbalí NÁŠ JEDINÝ CENÍK (menu Ceníky) a klepnutím
 * vyplní tenhle řádek - popis i cenu. Cena se dá přepsat.
 *
 * CENÍK JE V KORUNÁCH. U dokladu v jiné měně se proto vloží jen popis a cena
 * zůstane na člověku - přepočítat kurzem by znamenalo napsat do nabídky číslo,
 * které v ceníku nikde nestojí.
 *
 * Načítá se až při prvním otevření.
 */
export function VyberZCeniku({
  mena,
  onVlozit,
}: {
  mena: Currency;
  onVlozit: (popis: string, cenaMinor: number) => void;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [otevreno, setOtevreno] = useState(false);
  const [polozky, setPolozky] = useState<PolozkaCeniku[] | null>(null);
  const obal = useRef<HTMLSpanElement | null>(null);
  const vKorunach = mena === 'CZK';

  // Zavrit kliknutim jinam nebo Escapem.
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
    if (polozky !== null) return;
    const res = await fetch('/api/admin/doklady/cenik').catch(() => null);
    if (!res?.ok) {
      setPolozky([]);
      return;
    }
    const data = (await res.json().catch(() => null)) as { polozky?: PolozkaCeniku[] } | null;
    setPolozky(data?.polozky ?? []);
  }

  return (
    <span ref={obal} className="relative inline-flex">
      <button
        type="button"
        onClick={() => void otevri()}
        title={t('doklad.zCeniku')}
        aria-label={t('doklad.zCeniku')}
        className="shrink-0 text-muted hover:text-brand-purple text-lg font-heading leading-none px-1 bg-transparent border-0 cursor-pointer"
      >
        +
      </button>

      {otevreno && (
        <span className="absolute z-30 top-full right-0 mt-1 w-[360px] max-h-[340px] overflow-y-auto rounded-card border border-line bg-surface shadow-lg p-2 flex flex-col gap-0.5">
          {polozky === null && (
            <span className="text-xs font-body text-muted px-2 py-1.5">{t('doklad.cenikNacitam')}</span>
          )}
          {polozky !== null && polozky.length === 0 && (
            <span className="text-xs font-body text-muted px-2 py-1.5">{t('doklad.cenikPrazdny')}</span>
          )}
          {polozky !== null && polozky.length > 0 && !vKorunach && (
            <span className="text-[11px] font-body text-muted px-2 py-1.5">
              {t('doklad.cenikJenKoruny')}
            </span>
          )}
          {(polozky ?? []).map((p) => (
            <button
              key={p.klic}
              type="button"
              onClick={() => {
                onVlozit(p.popis, vKorunach ? (p.cenaMinor ?? 0) : 0);
                setOtevreno(false);
              }}
              className="flex items-center gap-3 text-left rounded-lg px-2 py-1.5 bg-transparent border-0 cursor-pointer hover:bg-field"
            >
              <span className="text-sm font-body text-ink grow min-w-0">{p.popis}</span>
              <span className="text-sm font-heading text-muted tabular-nums shrink-0">
                {/* Položka bez ceny je pomlčka, ne nula - cenu doplní člověk. */}
                {p.cenaMinor === null || !vKorunach ? '—' : formatMoney(p.cenaMinor, 'CZK', jazyk)}
              </span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
