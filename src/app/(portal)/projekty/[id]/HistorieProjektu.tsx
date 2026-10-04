import type { ProjektUdalost } from '@prisma/client';
import { BARVY_DRUHU, formatujCas, nazevDruhuUdalosti } from '@/lib/projektLog';
import { prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * Historie projektu (zadání 10. 9. 2026: „něco jako LOG u každého projektu —
 * takovou historii, co se v projektu upravilo a kdy šla nějaká notifikace").
 *
 * Od nejnovější dolů — člověk sem chodí na otázku „co se s tím stalo teď",
 * ne „jak to začalo".
 *
 * Zapisuje se jen skutečná změna: formulář posílá celou svou část, takže
 * uložení bez úpravy by jinak historii zaplevelilo řádky, kde se nic nestalo.
 */
export function HistorieProjektu({
  udalosti,
  jazyk,
}: {
  udalosti: ProjektUdalost[];
  /** Jazyk PROPEM - kartu kreslí serverová stránka (pravidlo 8). */
  jazyk: Jazyk;
}) {
  if (udalosti.length === 0) {
    return (
      <div className="bg-surface rounded-card border border-line shadow-sm p-6">
        <p className="text-sm font-body text-muted m-0">
          {prelozit(jazyk, 'historie.prazdno')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-field text-ink font-heading text-xs">
              <th className="text-left px-4 py-3 whitespace-nowrap">{prelozit(jazyk, 'historie.kdy')}</th>
              <th className="text-left px-4 py-3 whitespace-nowrap">{prelozit(jazyk, 'historie.co')}</th>
              <th className="text-left px-4 py-3">{prelozit(jazyk, 'historie.zmena')}</th>
              <th className="text-left px-4 py-3 whitespace-nowrap">{prelozit(jazyk, 'historie.kdo')}</th>
            </tr>
          </thead>
          <tbody>
            {udalosti.map((u) => (
              <tr key={u.id} className="border-t border-line align-top">
                <td className="px-4 py-3 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatujCas(u.createdAt, jazyk)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                      BARVY_DRUHU[u.druh]
                    }`}
                  >
                    {nazevDruhuUdalosti(u.druh, jazyk)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-heading text-ink max-w-[420px] break-words">
                  {u.popis}
                  {/* U odeslane zpravy je podstatne, komu presne sla. */}
                  {u.druh === 'NOTIFIKACE' && u.nova && (
                    <span className="block text-xs font-body text-muted mt-0.5">{u.nova}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-heading text-muted whitespace-nowrap">
                  {u.uzivatelJmeno || prelozit(jazyk, 'historie.portal')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
