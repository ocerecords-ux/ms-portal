'use client';

import { useState } from 'react';
import { MESICE, MESICE_ZKRATKA, koruny, korunyKratce, type MesicObratu } from '@/lib/palubovka';

/**
 * TŘINÁCT MĚSÍCŮ FAKTURACE (zadání 27. 9. 2026 - „vím, kam to směřuje").
 *
 * Jedna řada čísel, jeden úkol: vidět trend a hned poznat tenhle měsíc. Proto
 * ZVÝRAZNĚNÍ místo barevného rozlišování - běžící měsíc ve fialové značky,
 * hotové měsíce ve světlejším stupni téže barvy. Dvě barvy pro dvě věci, ne
 * dvanáct barev pro dvanáct sloupců.
 *
 * Cíl je vodorovná čára přes graf - proti ní se to čte na první pohled.
 * Hodnota u každého sloupce by byla změť, takže se popisuje jen poslední
 * (a nejvyšší) sloupec; zbytek řekne osa a bublina při najetí myší.
 */

const SIRKA = 680;
const VYSKA = 200;
const VLEVO = 44;
const DOLE = 26;
const NAHORE = 14;

export function PrubehMesicu({ rady, cil }: { rady: MesicObratu[]; cil: number | null }) {
  const [najeto, setNajeto] = useState<number | null>(null);

  const max = Math.max(...rady.map((m) => m.vyfakturovano), cil ?? 0, 1);
  // Osa do čistého čísla nahoru, ať ticky nejsou 137 482.
  const krok = Math.pow(10, Math.floor(Math.log10(max))) / 2;
  const strop = Math.ceil(max / krok) * krok;

  const plochaS = SIRKA - VLEVO - 12;
  const plochaV = VYSKA - DOLE - NAHORE;
  const sirkaSloupce = Math.min(24, (plochaS / rady.length) * 0.62);
  const stred = (i: number) => VLEVO + (plochaS / rady.length) * (i + 0.5);
  const y = (hodnota: number) => NAHORE + plochaV * (1 - hodnota / strop);

  const posledni = rady.length - 1;
  const ticky = [0, strop / 2, strop];

  return (
    <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-ink m-0">Fakturace po měsících</h2>
        <span className="text-xs font-body text-muted">bez DPH, posledních 13 měsíců</span>
        {cil ? (
          <span className="ml-auto text-xs font-body text-muted flex items-center gap-1.5">
            <span className="inline-block w-4 h-0 border-t-2 border-dashed border-muted" aria-hidden="true" />
            měsíční cíl {koruny(cil)}
          </span>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${SIRKA} ${VYSKA}`} className="w-full h-auto" role="img" aria-label="Fakturace po měsících">
        {ticky.map((t) => (
          <g key={t}>
            <line x1={VLEVO} y1={y(t)} x2={SIRKA - 12} y2={y(t)} stroke="currentColor" className="text-line" strokeWidth="1" />
            <text x={VLEVO - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[10px] tabular-nums font-body">
              {korunyKratce(t)}
            </text>
          </g>
        ))}

        {cil && cil <= strop ? (
          <line
            x1={VLEVO}
            y1={y(cil)}
            x2={SIRKA - 12}
            y2={y(cil)}
            stroke="currentColor"
            className="text-muted"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        ) : null}

        {rady.map((m, i) => {
          const bezici = i === posledni;
          const vyska = Math.max(0, y(0) - y(m.vyfakturovano));
          return (
            <g
              key={`${m.rok}-${m.mesic}`}
              onMouseEnter={() => setNajeto(i)}
              onMouseLeave={() => setNajeto(null)}
            >
              {/* Terč pro myš je celý sloupec plochy, ne jen tenký obdélník. */}
              <rect
                x={stred(i) - plochaS / rady.length / 2}
                y={NAHORE}
                width={plochaS / rady.length}
                height={plochaV}
                fill="transparent"
              />
              <rect
                x={stred(i) - sirkaSloupce / 2}
                y={y(m.vyfakturovano)}
                width={sirkaSloupce}
                height={vyska}
                rx="4"
                fill={bezici ? '#6B2AF0' : '#B49BFF'}
                opacity={najeto === null || najeto === i ? 1 : 0.55}
              />
              <text
                x={stred(i)}
                y={VYSKA - 8}
                textAnchor="middle"
                className={`text-[10px] font-body ${bezici ? 'fill-ink' : 'fill-muted'}`}
              >
                {MESICE_ZKRATKA[m.mesic - 1]}
              </text>
            </g>
          );
        })}

        {/* Popisek jen u běžícího měsíce - hodnota u každého sloupce je změť. */}
        {rady[posledni] && rady[posledni].vyfakturovano > 0 && (
          <text
            x={stred(posledni)}
            y={y(rady[posledni].vyfakturovano) - 6}
            textAnchor="end"
            className="fill-ink text-[11px] font-heading font-semibold"
          >
            {korunyKratce(rady[posledni].vyfakturovano)}
          </text>
        )}
      </svg>

      <p className="text-xs font-body text-muted m-0 min-h-[1.2em]">
        {najeto !== null && rady[najeto]
          ? `${MESICE[rady[najeto].mesic - 1]} ${rady[najeto].rok}: vyfakturováno ${koruny(
              rady[najeto].vyfakturovano,
            )}, z toho uhrazeno ${koruny(rady[najeto].uhrazeno)}`
          : 'Najetím myší na sloupec se ukáže přesná částka.'}
      </p>
    </section>
  );
}
