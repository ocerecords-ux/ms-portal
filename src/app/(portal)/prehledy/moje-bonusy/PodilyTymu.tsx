'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { koruny } from '@/lib/palubovka';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

type Radek = {
  id: string;
  jmeno: string;
  procento: number;
  bonusMesic: number;
  bonusRok: number;
};

/**
 * PODÍLY CELÉHO TÝMU (zadání 6. 10. 2026: „a ještě bych měl mít já možnost
 * upravit ta procenta").
 *
 * Procento se přepíše rovnou tady a uloží se po odkliknutí - rozdělovat podíly
 * se dělá nad tímhle přehledem, kde je hned vidět, co to s čísly udělá.
 * Měnit je dál jde i na kartě uživatele; tohle je jen pohodlnější cesta.
 *
 * Prázdné pole (nebo nula) znamená žádný podíl - takovému člověku se záložka
 * přestane ukazovat.
 */
export function PodilyTymu({ radky, mesicNazev, rok }: { radky: Radek[]; mesicNazev: string; rok: number }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [hodnoty, setHodnoty] = useState<Record<string, string>>(
    () => Object.fromEntries(radky.map((r) => [r.id, String(r.procento)])),
  );
  const [uklada, setUklada] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(r: Radek) {
    const text = (hodnoty[r.id] ?? '').replace(',', '.').trim();
    const cislo = text === '' ? null : Number(text);
    if (cislo !== null && (Number.isNaN(cislo) || cislo < 0 || cislo > 100)) {
      setChyba(t('bonusObratu.chybaProcento'));
      setHodnoty((h) => ({ ...h, [r.id]: String(r.procento) }));
      return;
    }
    if ((cislo ?? 0) === r.procento) return;
    setUklada(r.id);
    setChyba(null);
    try {
      const res = await fetch('/api/prehledy/podily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: r.id, procento: cislo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || t('bonusObratu.chybaUlozeni'));
        setHodnoty((h) => ({ ...h, [r.id]: String(r.procento) }));
        return;
      }
      router.refresh();
    } catch {
      setChyba(t('bonusObratu.chybaUlozeni'));
      setHodnoty((h) => ({ ...h, [r.id]: String(r.procento) }));
    } finally {
      setUklada(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 py-1 text-xs font-heading font-semibold uppercase tracking-wide text-muted">
        <span className="min-w-0">{t('bonusObratu.clovek')}</span>
        <span className="flex items-center gap-4 sm:gap-6 shrink-0">
          <span className="w-20 text-right">{t('bonusObratu.podil')}</span>
          <span className="w-24 sm:w-28 text-right">{mesicNazev}</span>
          <span className="w-24 sm:w-28 text-right">{rok}</span>
        </span>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {radky.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-4 py-2">
            <span className="font-heading text-sm text-ink min-w-0 truncate">{r.jmeno}</span>
            <span className="flex items-center gap-4 sm:gap-6 shrink-0 tabular-nums">
              <span className="w-20 flex items-center justify-end gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={hodnoty[r.id] ?? ''}
                  disabled={uklada !== null}
                  onChange={(e) => setHodnoty((h) => ({ ...h, [r.id]: e.target.value }))}
                  onBlur={() => void uloz(r)}
                  aria-label={t('bonusObratu.podilCloveka', { jmeno: r.jmeno })}
                  className="w-14 rounded-lg border border-line bg-field px-2 py-1 text-right text-sm font-heading text-ink tabular-nums outline-none focus:border-brand-purple disabled:opacity-60"
                />
                <span className="text-xs font-body text-muted">%</span>
              </span>
              <span className="w-24 sm:w-28 text-right text-sm font-heading font-semibold text-ink">
                {koruny(r.bonusMesic, jazyk)}
              </span>
              <span className="w-24 sm:w-28 text-right text-sm font-body text-muted">
                {koruny(r.bonusRok, jazyk)}
              </span>
            </span>
          </div>
        ))}
      </div>
      {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}
    </div>
  );
}
