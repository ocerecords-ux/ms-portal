import Link from 'next/link';
import type { NeodeslanaFaktura } from '@/lib/neodeslaneFaktury';
import { formatDatumCas, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * ČERVENÝ PRUH NAD FAKTURAMI (zadání 29. 10. 2026: „když se stane, že se
 * neodešle z nějakého důvodu faktura, tak by to mělo nějak zařvat").
 *
 * Ukazuje se na KAŽDÉ záložce Faktur, ne jen na té otevřené: faktura, která
 * neodešla, zůstává rozepsaná, takže v Neuhrazených - kam se chodí nejčastěji
 * - by ji nikdo neviděl.
 *
 * Nejde zavřít. Zmizí sama ve chvíli, kdy faktura doopravdy odejde; kdyby
 * šla odklepnout, bylo by to první, co každý udělá, a zakázka by zůstala
 * nevyfakturovaná potichu dál.
 */
export function NeodeslaneFaktury({
  faktury,
  jazyk,
}: {
  faktury: NeodeslanaFaktura[];
  jazyk: Jazyk;
}) {
  if (faktury.length === 0) return null;

  return (
    <div className="bg-dangerTint border border-danger rounded-card px-5 py-4 flex flex-col gap-2">
      <p className="font-heading font-semibold text-danger text-sm m-0 uppercase tracking-wide">
        {faktury.length === 1
          ? prelozit(jazyk, 'faktura.neodeslaNadpisJedna')
          : prelozitS(jazyk, 'faktura.neodeslaNadpis', { pocet: faktury.length })}
      </p>

      <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
        {faktury.map((f) => (
          <li key={f.id} className="flex items-baseline gap-2 flex-wrap">
            <Link
              href={`/admin/doklady/faktury/${f.id}`}
              className="font-heading font-semibold text-sm text-danger no-underline hover:underline"
            >
              {f.cislo}
            </Link>
            <span className="text-sm font-body text-ink">
              {[f.odberatel, f.projekt].filter(Boolean).join(' · ')}
            </span>
            <span className="text-sm font-body text-danger">— {f.duvod}</span>
            {f.kdy && (
              <span className="text-xs font-body text-muted">{formatDatumCas(jazyk, f.kdy)}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs font-body text-muted m-0">
        {prelozit(jazyk, 'faktura.neodeslaPoznamka')}
      </p>
    </div>
  );
}
