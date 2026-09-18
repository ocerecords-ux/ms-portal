'use client';

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
 * bublina s textem. Proto se teď needituje NIC JINÉHO NEŽ TA IKONA.
 *
 * JEDEN KLIK = JEDNA ČÁRKA NAVÍC, a po třetí se to vrátí na jednu (upřesnění
 * 18. 9. 2026: „jedním klikem jedna čárka, druhým klikem dvě čárky a dalším
 * klikem třetí čárka a dalším klikem zase jedna"). Celá ikona je jedno
 * tlačítko - dřív byl každý sloupeček vlastní cíl a do tří pixelů se člověk
 * snadno překlikl a nastavil nechtěný stupeň. Takhle je jedno, kam se
 * klepne, a překlep se opraví dalším klepnutím na tomtéž místě.
 *
 * Kreslí to jediná funkce `Sloupecek` - kdyby měl náhled a úprava vlastní
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
 * Úprava - tatáž kresba, jen je z ní tlačítko.
 *
 * Bez priority se nekreslí pomlčka, ale tři zhasnuté sloupečky: musí být
 * kam klepnout, jinak by prioritu nešlo přidat tam, kde ještě žádná není.
 *
 * Klepnutí přidá čárku, po třetí se vrátí na jednu. Tlačítko je celá ikona
 * i s odsazením kolem ní (záporné okraje si to místo berou zpátky, takže se
 * kvůli tomu nikde nic neposune) - trefit se dá i prstem na telefonu.
 */
export function VyberPriority({
  priorita,
  onZmena,
  velikost = 18,
  uklada = false,
}: {
  priorita: ProjectPriority | null | undefined;
  onZmena: (nova: ProjectPriority) => void;
  velikost?: number;
  /** Ukládá se - ať je vidět, že se něco děje, a neklepe se dvakrát. */
  uklada?: boolean;
}) {
  const stupen = priorita && STUPEN[priorita] ? STUPEN[priorita] : 0;
  // Dokola: 1 -> 2 -> 3 -> 1. Z prazdneho se zacina jednou carkou.
  const dalsi = PODLE_STUPNE[stupen >= 3 ? 0 : stupen];
  const barva = stupen > 0 ? BARVA[PODLE_STUPNE[stupen - 1]] : 'text-muted';
  const popisek = stupen > 0 ? PRIORITY_LABELS[PODLE_STUPNE[stupen - 1]] : 'bez priority';

  return (
    <button
      type="button"
      disabled={uklada}
      onClick={() => onZmena(dalsi)}
      title={`Priorita: ${popisek} — klepnutím ${PRIORITY_LABELS[dalsi].toLowerCase()}`}
      aria-label={`Priorita: ${popisek}. Klepnutím nastavíte: ${PRIORITY_LABELS[dalsi]}`}
      className={`inline-flex items-end gap-[2px] align-middle px-1.5 py-1 -mx-1.5 -my-1 rounded ${barva} ${
        uklada ? 'opacity-60' : 'hover:bg-field'
      }`}
      style={{ height: velikost + 8 }}
    >
      {[1, 2, 3].map((i) => (
        <span key={i} className="flex items-end" style={{ height: velikost }}>
          <Sloupecek podil={i / 3} svitici={i <= stupen} />
        </span>
      ))}
    </button>
  );
}
