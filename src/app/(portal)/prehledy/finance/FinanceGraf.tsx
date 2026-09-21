'use client';

import { useState } from 'react';
import { kc, kcKratce } from './format';

type Usek = { klic: string; popis: string; obrat: number; naklady: number; zisk: number };

/** Hezké dělení osy: 0, 250 tis., 500 tis.… */
function osa(min: number, max: number): { dole: number; nahore: number; znacky: number[] } {
  const rozsah = Math.max(max - min, 1);
  const hrubyKrok = rozsah / 4;
  const rad = 10 ** Math.floor(Math.log10(hrubyKrok));
  const krok = [1, 2, 2.5, 5, 10].map((k) => k * rad).find((k) => k >= hrubyKrok) ?? 10 * rad;
  const dole = Math.floor(min / krok) * krok;
  const nahore = Math.ceil(max / krok) * krok || krok;
  const znacky: number[] = [];
  for (let v = dole; v <= nahore + krok / 2; v += krok) znacky.push(v);
  return { dole, nahore, znacky };
}

/**
 * Hlavní graf: obrat a náklady jako dvojice sloupců, zisk jako čára přes ně -
 * všechno v korunách, takže sdílí jednu osu. Najetí (nebo ťuknutí na
 * telefonu) ukáže přesná čísla úseku. Pod grafem jde přepnout na tabulku.
 */
export function FinanceGraf({ useky }: { useky: Usek[] }) {
  const [aktivni, setAktivni] = useState<number | null>(null);
  const [tabulka, setTabulka] = useState(false);

  const hodnoty = useky.flatMap((u) => [u.obrat, u.naklady, u.zisk]);
  const { dole, nahore, znacky } = osa(Math.min(0, ...hodnoty), Math.max(0, ...hodnoty));
  const rozsah = nahore - dole;
  /** Vzdálenost hodnoty od spodku grafu v procentech. */
  const odSpodu = (v: number) => ((v - dole) / rozsah) * 100;
  const nula = odSpodu(0);
  const n = useky.length;
  const kazdyDruhy = n > 12;

  const bod = (i: number) => ({ x: ((i + 0.5) / n) * 100, y: 100 - odSpodu(useky[i].zisk) });
  const cara = useky.map((_, i) => `${bod(i).x},${bod(i).y}`).join(' ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 flex-wrap text-xs font-heading text-muted">
        <Legenda barva="var(--viz-obrat)">Obrat</Legenda>
        <Legenda barva="var(--viz-naklady)">Náklady</Legenda>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 rounded bg-ink" />
          <span className="inline-block w-2 h-2 rounded-full bg-ink -ml-3" />
          Zisk
        </span>
        <button
          type="button"
          onClick={() => setTabulka((t) => !t)}
          className="ml-auto text-xs font-heading font-semibold text-brand-purple bg-transparent border-0"
        >
          {tabulka ? 'Zobrazit graf' : 'Zobrazit tabulku'}
        </button>
      </div>

      {tabulka ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body border-collapse">
            <thead>
              <tr className="text-xs font-heading text-muted uppercase tracking-wide">
                <th className="text-left py-2 pr-3">Období</th>
                <th className="text-right py-2 px-3">Obrat</th>
                <th className="text-right py-2 px-3">Náklady</th>
                <th className="text-right py-2 pl-3">Zisk</th>
              </tr>
            </thead>
            <tbody>
              {useky.map((u) => (
                <tr key={u.klic} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-ink">{u.popis}</td>
                  <td className="text-right py-1.5 px-3 tabular-nums">{kc(u.obrat)}</td>
                  <td className="text-right py-1.5 px-3 tabular-nums">{kc(u.naklady)}</td>
                  <td className={`text-right py-1.5 pl-3 tabular-nums font-heading ${u.zisk < 0 ? 'text-danger' : 'text-ink'}`}>
                    {kc(u.zisk)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Osa Y */}
          <div className="relative w-14 shrink-0 h-64 text-[11px] font-body text-muted tabular-nums">
            {znacky.map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - odSpodu(v)}%` }}>
                {kcKratce(v)}
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="relative h-64" onMouseLeave={() => setAktivni(null)}>
              {/* Mřížka - nenápadná, nula výraznější */}
              {znacky.map((v) => (
                <span
                  key={v}
                  className={`absolute left-0 right-0 h-px ${v === 0 ? 'bg-muted opacity-50' : 'bg-line'}`}
                  style={{ top: `${100 - odSpodu(v)}%` }}
                />
              ))}

              {/* Sloupce + zásahová plocha přes celý sloupec */}
              <div className="absolute inset-0 flex">
                {useky.map((u, i) => (
                  <div
                    key={u.klic}
                    className={`relative flex-1 cursor-default ${aktivni === i ? 'bg-tint' : ''}`}
                    onMouseEnter={() => setAktivni(i)}
                    onClick={() => setAktivni(aktivni === i ? null : i)}
                  >
                    <div
                      className="absolute left-0 right-0 flex justify-center items-end gap-0.5 px-[12%]"
                      style={{ bottom: `${nula}%`, height: `${100 - nula}%` }}
                    >
                      <Sloupec hodnota={u.obrat} nahore={nahore} barva="var(--viz-obrat)" />
                      <Sloupec hodnota={u.naklady} nahore={nahore} barva="var(--viz-naklady)" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Zisk - čára a body */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                <polyline
                  points={cara}
                  fill="none"
                  stroke="rgb(var(--c-ink))"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {useky.map((u, i) => (
                <span
                  key={u.klic}
                  className="absolute w-2.5 h-2.5 rounded-full bg-ink pointer-events-none -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${bod(i).x}%`,
                    top: `${bod(i).y}%`,
                    boxShadow: '0 0 0 2px rgb(var(--c-surface))',
                    transform: `translate(-50%, -50%) scale(${aktivni === i ? 1.3 : 1})`,
                  }}
                />
              ))}

              {/* Bublina s čísly */}
              {aktivni !== null && (
                <div
                  className="absolute top-1 z-10 pointer-events-none bg-surface border border-line rounded-lg shadow-lg px-3 py-2 text-xs font-body min-w-[170px]"
                  style={
                    bod(aktivni).x > 60
                      ? { right: `${100 - bod(aktivni).x + 100 / n / 2}%` }
                      : { left: `${bod(aktivni).x + 100 / n / 2}%` }
                  }
                >
                  <p className="font-heading font-semibold text-ink m-0 mb-1">{useky[aktivni].popis}</p>
                  <Radek barva="var(--viz-obrat)" popis="Obrat" hodnota={useky[aktivni].obrat} />
                  <Radek barva="var(--viz-naklady)" popis="Náklady" hodnota={useky[aktivni].naklady} />
                  <Radek barva="rgb(var(--c-ink))" popis="Zisk" hodnota={useky[aktivni].zisk} tucne />
                </div>
              )}
            </div>

            {/* Osa X */}
            <div className="flex text-[11px] font-body text-muted">
              {useky.map((u, i) => (
                <span key={u.klic} className="flex-1 text-center truncate">
                  {kazdyDruhy && i % 2 === 1 ? '' : u.popis}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sloupec({ hodnota, nahore, barva }: { hodnota: number; nahore: number; barva: string }) {
  if (hodnota <= 0 || nahore <= 0) return <span className="flex-1 max-w-[22px]" />;
  return (
    <span
      className="flex-1 max-w-[22px] rounded-t"
      style={{ height: `${Math.max(0.5, (hodnota / nahore) * 100)}%`, backgroundColor: barva }}
    />
  );
}

function Legenda({ barva, children }: { barva: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: barva }} />
      {children}
    </span>
  );
}

function Radek({ barva, popis, hodnota, tucne }: { barva: string; popis: string; hodnota: number; tucne?: boolean }) {
  return (
    <p className="flex items-center gap-2 m-0 py-0.5">
      <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: barva }} />
      <span className="text-muted">{popis}</span>
      <span className={`ml-auto tabular-nums ${tucne ? 'font-heading font-semibold' : ''} ${hodnota < 0 ? 'text-danger' : 'text-ink'}`}>
        {kc(hodnota)}
      </span>
    </p>
  );
}
