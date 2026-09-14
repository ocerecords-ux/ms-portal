'use client';

import { formatMoney, minorToInput, parseMoneyToMinor, type Totals } from '@/lib/doklady';
import type { Currency } from '@prisma/client';

/**
 * Sleva na dokladu (zadání 14. 9. 2026: „potřebuju u nabídek a faktur mít
 * možnost přidat nějakou slevu").
 *
 * Jedno políčko pro obojí by lhalo - „10" je jednou deset procent a jednou
 * deset korun. Proto se nejdřív vybere ČÍM se slevuje a teprve pak kolik.
 *
 * Sleva se počítá ZE ZÁKLADU BEZ DPH a rozpočítá se mezi sazby - viz
 * computeTotals. Popis je nepovinný; když se vyplní, vytiskne se na dokladu
 * vedle částky, aby klient věděl, za co slevu dostal.
 */
export type SlevaHodnoty = {
  slevaProcent: number;
  slevaMinor: number;
  slevaPopis: string;
};

export function SlevaPole({
  hodnoty,
  onZmena,
  currency,
  totals,
  locked,
}: {
  hodnoty: SlevaHodnoty;
  onZmena: (zmena: Partial<SlevaHodnoty>) => void;
  currency: Currency;
  totals: Totals;
  locked?: boolean;
}) {
  const druh = hodnoty.slevaProcent > 0 ? 'PROCENTA' : hodnoty.slevaMinor > 0 ? 'CASTKA' : 'ZADNA';

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple';

  if (locked) {
    if (totals.sleva <= 0) return null;
    return (
      <div className="flex items-center justify-between text-sm font-heading">
        <span className="text-muted">
          Sleva{hodnoty.slevaPopis ? ` · ${hodnoty.slevaPopis}` : ''}
          {hodnoty.slevaProcent > 0 ? ` (${hodnoty.slevaProcent} %)` : ''}
        </span>
        <span className="text-danger tabular-nums">− {formatMoney(totals.sleva, currency)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2 mt-1">
      <div className="flex items-center gap-2">
        <select
          value={druh}
          onChange={(e) => {
            const v = e.target.value;
            // Prepnuti druhu vzdy vynuluje to druhe - jinak by v databazi
            // zustala viset stara hodnota a pri dalsi uprave se vratila.
            if (v === 'ZADNA') onZmena({ slevaProcent: 0, slevaMinor: 0 });
            else if (v === 'PROCENTA') onZmena({ slevaMinor: 0, slevaProcent: 10 });
            else onZmena({ slevaProcent: 0, slevaMinor: 100 });
          }}
          className={`${inputClass} flex-1 min-w-0`}
        >
          <option value="ZADNA">Bez slevy</option>
          <option value="PROCENTA">Sleva v procentech</option>
          <option value="CASTKA">Sleva pevnou částkou</option>
        </select>

        {druh === 'PROCENTA' && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={hodnoty.slevaProcent || ''}
              onChange={(e) => onZmena({ slevaProcent: Number(e.target.value) || 0, slevaMinor: 0 })}
              className={`${inputClass} w-24 text-right tabular-nums`}
            />
            <span className="text-sm font-heading text-muted">%</span>
          </div>
        )}

        {druh === 'CASTKA' && (
          <input
            type="text"
            inputMode="decimal"
            value={hodnoty.slevaMinor ? minorToInput(hodnoty.slevaMinor) : ''}
            onChange={(e) => onZmena({ slevaMinor: parseMoneyToMinor(e.target.value), slevaProcent: 0 })}
            placeholder="0.00"
            className={`${inputClass} w-32 text-right tabular-nums`}
          />
        )}
      </div>

      {druh !== 'ZADNA' && (
        <>
          <input
            type="text"
            value={hodnoty.slevaPopis}
            onChange={(e) => onZmena({ slevaPopis: e.target.value })}
            placeholder="Za co sleva je (nepovinné) — vytiskne se na dokladu"
            className={inputClass}
          />
          <div className="flex items-center justify-between text-sm font-heading">
            <span className="text-muted">Sleva</span>
            <span className="text-danger tabular-nums">− {formatMoney(totals.sleva, currency)}</span>
          </div>
        </>
      )}
    </div>
  );
}
