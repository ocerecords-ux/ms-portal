import { ValecProgresu } from '@/components/ValecProgresu';
import type { ProgresProjektu } from '@/lib/progresNataceniServer';

/**
 * PROGRES NATÁČENÍ V DETAILU PROJEKTU (zadání 19. 9. 2026: „hlavně my
 * v detailu projektu"). Nahoře celý projekt, pod ním každý herec zvlášť -
 * u knihy s víc herci je každý jinde.
 *
 * Počítá se: poslední zapsaná strana (Natáčecí protokol / Bruno) proti
 * počtu stran PDF s textem ve složce projektu. Dotočeno = 100 %.
 */
export function ProgresNataceniKarta({
  progres,
  herci,
}: {
  progres: ProgresProjektu | null;
  herci: { id: string; jmeno: string }[];
}) {
  const stran = progres?.stranTextu ?? null;
  return (
    <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Progres natáčení
        </h2>
        <span className="text-xs font-body text-muted">
          {stran
            ? `Text má ${stran} ${stran === 1 ? 'stranu' : stran <= 4 ? 'strany' : 'stran'} (PDF ve složce projektu)`
            : 'Ve složce projektu zatím není PDF s textem (název končí _RE)'}
        </span>
      </div>

      <ValecProgresu progres={progres?.celkem ?? null} prazdne="Zatím se nedá spočítat - chybí text nebo zápis strany." />

      {herci.length > 1 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-3 border-t border-line pt-4">
          {herci.map((h) => (
            <li key={h.id} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] items-center gap-x-4 gap-y-1">
              <span className="font-heading font-semibold text-sm text-ink truncate">{h.jmeno}</span>
              <ValecProgresu progres={progres?.herci[h.id] ?? null} prazdne="zatím bez zápisu" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
