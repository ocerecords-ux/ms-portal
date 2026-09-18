'use client';

import { useState } from 'react';
import type { ProjectPriority } from '@prisma/client';
import { PRIORITY_LABELS } from '@/lib/projectTypes';

/**
 * PRIORITA GRAFICKY (zadání 18. 9. 2026: „ještě bych předělal nějak pole
 * Priorita. Nepsal bych to slovem, ale udělal graficky nějak, třeba ikonou
 * tři stupně").
 *
 * Tři sloupečky jako signál na mobilu: nízká = jeden, střední = dva, vysoká
 * = tři. Slovo „Střední" zabíralo v přehledu celý sloupec a člověk ho stejně
 * četl jen na první písmeno.
 *
 * ÚROVEŇ NESE TVAR, NE JEN BARVA. Kdo barvy rozlišuje hůř (a červená se
 * zelenou je nejčastější případ), pozná prioritu podle počtu sloupečků -
 * a v bublině je pořád celé slovo, takže se nic neztratí.
 *
 * STEJNĚ VŠUDE, I KDYŽ SE MĚNÍ (upřesnění tentýž den: „v náhledu nejde
 * změnit a objevují se tam slova. V detailu to musí být graficky stejné!
 * Vymysli, jak se tam ty čárky budou přidávat a ubírat. Dělal bych to např
 * klikáním na tu ikonu").
 *
 * Do teď se při úpravě ikona vyměnila za rozbalovátko se slovy - v přehledu
 * se do úzkého sloupce nevešlo („Vysc…") a v kartě projektu z toho byla
 * bublina s textem. Proto se teď needituje NIC JINÉHO NEŽ TA IKONA: klepnutí
 * na sloupeček nastaví jeho stupeň, klepnutí na už nastavený stupeň prioritu
 * zruší. Přidávání i ubírání jedním gestem, jako u hvězdiček.
 *
 * Kreslí to jediná funkce `Sloupecky` - kdyby měl náhled a úprava vlastní
 * kresbu, rozešly by se při první úpravě jedné z nich.
 */

const STUPEN: Record<ProjectPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
/** Pořadí odpovídá stupňům 1-3 výše. */
const PODLE_STUPNE: ProjectPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

/** Barva nese jen důraz: čím výš, tím naléhavěji. */
const BARVA: Record<ProjectPriority, string> = {
  LOW: 'text-muted',
  MEDIUM: 'text-status-progress',
  HIGH: 'text-danger',
};

/** Nedosažené stupně zůstávají vidět jako obrys - jinak by nebylo poznat,
 *  jestli je to „nízká ze tří", nebo jediný možný stav. */
const ZHASLE = 0.22;

function Sloupecek({ podil, svitici }: { podil: number; svitici: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="w-[3px] rounded-[1px] bg-current"
      style={{ height: `${podil * 100}%`, opacity: svitici ? 1 : ZHASLE }}
    />
  );
}

/** Náhled - jen kresba, nikde se na ni neklepe. */
export function IkonaPriority({
  priorita,
  velikost = 16,
}: {
  priorita: ProjectPriority | null | undefined;
  velikost?: number;
}) {
  if (!priorita || !STUPEN[priorita]) return <span className="text-muted">—</span>;

  const stupen = STUPEN[priorita];
  const popisek = PRIORITY_LABELS[priorita];

  return (
    <span
      title={`Priorita: ${popisek}`}
      aria-label={`Priorita: ${popisek}`}
      role="img"
      className={`inline-flex items-end gap-[2px] align-middle ${BARVA[priorita]}`}
      style={{ height: velikost }}
    >
      {[1, 2, 3].map((i) => (
        <Sloupecek key={i} podil={i / 3} svitici={i <= stupen} />
      ))}
    </span>
  );
}

/**
 * Úprava - tatáž kresba, jen se do ní klepe.
 *
 * Bez priority se nekreslí pomlčka, ale tři zhasnuté sloupečky: musí být
 * kam klepnout, jinak by prioritu nešlo přidat tam, kde ještě žádná není.
 *
 * Sloupeček je 3 px široký, tlačítko kolem něj 12 px - prstem na telefonu
 * se do tří pixelů netrefí nikdo.
 */
export function VyberPriority({
  priorita,
  onZmena,
  velikost = 18,
  uklada = false,
}: {
  priorita: ProjectPriority | null | undefined;
  /** `null` = priorita se ruší. */
  onZmena: (nova: ProjectPriority | null) => void;
  velikost?: number;
  /** Ukládá se - ať je vidět, že se něco děje, a neklepe se dvakrát. */
  uklada?: boolean;
}) {
  const [nahled, setNahled] = useState<number | null>(null);

  const stupen = priorita && STUPEN[priorita] ? STUPEN[priorita] : 0;
  // Pod kurzorem se ukazuje, co klepnutí udělá - ještě než se klepne.
  const ukazany = nahled ?? stupen;
  const barva = ukazany > 0 ? BARVA[PODLE_STUPNE[ukazany - 1]] : 'text-muted';
  const popisek = priorita && PRIORITY_LABELS[priorita] ? PRIORITY_LABELS[priorita] : 'bez priority';

  return (
    <span
      className={`inline-flex items-end align-middle ${barva} ${uklada ? 'opacity-60' : ''}`}
      style={{ height: velikost }}
      onMouseLeave={() => setNahled(null)}
      aria-label={`Priorita: ${popisek}`}
    >
      {[1, 2, 3].map((i) => {
        const jeAktualni = i === stupen;
        return (
          <button
            key={i}
            type="button"
            disabled={uklada}
            // Klepnutí na nastavený stupeň prioritu zruší - tím se dá ubírat.
            onClick={() => onZmena(jeAktualni ? null : PODLE_STUPNE[i - 1])}
            onMouseEnter={() => setNahled(i)}
            onFocus={() => setNahled(i)}
            onBlur={() => setNahled(null)}
            title={
              jeAktualni
                ? `${PRIORITY_LABELS[PODLE_STUPNE[i - 1]]} — klepnutím zrušíte`
                : `Nastavit: ${PRIORITY_LABELS[PODLE_STUPNE[i - 1]]}`
            }
            className="h-full w-[12px] flex items-end justify-center cursor-pointer disabled:cursor-default"
          >
            <Sloupecek podil={i / 3} svitici={i <= ukazany} />
          </button>
        );
      })}
    </span>
  );
}
