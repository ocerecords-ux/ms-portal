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
 */

const STUPEN: Record<ProjectPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

/** Barva nese jen důraz: čím výš, tím naléhavěji. */
const BARVA: Record<ProjectPriority, string> = {
  LOW: 'text-muted',
  MEDIUM: 'text-status-progress',
  HIGH: 'text-danger',
};

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
        <span
          key={i}
          aria-hidden="true"
          className="w-[3px] rounded-[1px] bg-current"
          style={{
            height: `${(i / 3) * 100}%`,
            // Nedosazene stupne zustavaji videt jako obrys - jinak by nebylo
            // poznat, jestli je to „nizka ze tri", nebo jediny mozny stav.
            opacity: i <= stupen ? 1 : 0.22,
          }}
        />
      ))}
    </span>
  );
}
