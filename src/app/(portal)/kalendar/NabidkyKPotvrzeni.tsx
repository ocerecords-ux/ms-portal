import Link from 'next/link';
import type { NabidkaKPotvrzeni } from '@/lib/nabidkyNaPotvrzeni';
import { zbyvaHodin } from '@/lib/nabidkyNaPotvrzeni';
import { formatDatumCas, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * ČERVENÝ PRUH NAD KALENDÁŘEM (zadání 16. 11. 2026: „ať to zařve hlavně
 * Helče").
 *
 * Výběr termínů od herce se drží jen pár desítek hodin a pak propadne zpátky
 * do nabídky. Zvonek na to nestačil — viz lib/nabidkyNaPotvrzeni.ts. Tady to
 * svítí tak dlouho, dokud se s tím něco neudělá, a nejde to zavřít.
 */
export function NabidkyKPotvrzeni({
  nabidky,
  jazyk,
}: {
  nabidky: NabidkaKPotvrzeni[];
  jazyk: Jazyk;
}) {
  if (nabidky.length === 0) return null;

  return (
    <div className="bg-dangerTint border border-danger rounded-card px-5 py-4 flex flex-col gap-2">
      <p className="font-heading font-semibold text-danger text-sm m-0 uppercase tracking-wide">
        {nabidky.length === 1
          ? prelozit(jazyk, 'nabidkaTerminu.cekaNadpisJedna')
          : prelozitS(jazyk, 'nabidkaTerminu.cekaNadpis', { pocet: nabidky.length })}
      </p>

      <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
        {nabidky.map((n) => (
          <li key={n.id} className="flex items-baseline gap-2 flex-wrap">
            <Link
              href={`/kalendar/nabidka/${n.id}`}
              className="font-heading font-semibold text-sm text-danger no-underline hover:underline"
            >
              {n.projectName}
            </Link>
            <span className="text-sm font-body text-ink">{n.actorName}</span>
            <span className="text-sm font-body text-danger">
              {n.propadloKdy
                ? prelozitS(jazyk, 'nabidkaTerminu.cekaPropadlo', {
                    kdy: formatDatumCas(jazyk, n.propadloKdy),
                  })
                : prelozitS(jazyk, 'nabidkaTerminu.cekaDrzeno', {
                    vybrano: n.vybrano,
                    potreba: n.potreba,
                    kdy: formatDatumCas(jazyk, n.doKdy),
                    hodin: zbyvaHodin(n.doKdy),
                  })}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs font-body text-muted m-0">
        {prelozit(jazyk, 'nabidkaTerminu.cekaPoznamka')}
      </p>
    </div>
  );
}
