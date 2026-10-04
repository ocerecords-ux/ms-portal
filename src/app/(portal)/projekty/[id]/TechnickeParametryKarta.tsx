import Link from 'next/link';
import { VypisParametru } from '@/app/(portal)/components/VypisParametru';
import type { ParametryProjektu } from '@/lib/technickeParametryServer';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * ZÁLOŽKA TECHNICKÉ PARAMETRY (zadání 27. 9. 2026: „dej mi to jako záložku
 * v detailu projektu").
 *
 * Jen ke čtení - upravuje se to na jednom místě v Administraci, aby změna
 * platila pro všechny projekty té firmy. Kdo na to právo má, má tu rovnou
 * proklik; ostatní vidí aspoň, odkud parametry jsou.
 *
 * Nadpis je název sady, ne „Technické parametry" - to už stojí na záložce
 * a dvakrát po sobě by to jen zabíralo řádek.
 */
export function TechnickeParametryKarta({
  parametry,
  smiMenit,
  jazyk,
}: {
  parametry: ParametryProjektu;
  smiMenit: boolean;
  /** Jazyk PROPEM - kartu kreslí serverová stránka (pravidlo 8). */
  jazyk: Jazyk;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-base text-ink m-0">
          {parametry.profil.nazev}
        </h2>
        <span className="text-xs font-body text-muted">
          {parametry.vychoziSada
            ? prelozit(jazyk, 'technKarta.obecnaSada')
            : parametry.firmaName
              ? prelozitS(jazyk, 'technKarta.podleKlienta', { firma: parametry.firmaName })
              : prelozit(jazyk, 'technKarta.podleKlientaBez')}
        </span>
        {smiMenit && (
          <Link
            href="/admin/technicke-parametry"
            className="ml-auto text-xs font-heading text-brand-purple no-underline hover:underline"
          >
            {prelozit(jazyk, 'technKarta.upravitSady')}
          </Link>
        )}
      </div>
      {parametry.profil.perex && (
        <p className="text-xs font-body text-muted m-0">{parametry.profil.perex}</p>
      )}
      <VypisParametru sekce={parametry.sekce} sloupce />
      <p className="text-xs font-body text-muted m-0 pt-2 border-t border-line">
        {prelozit(jazyk, 'technKarta.vedouSeUFirem')}
      </p>
    </section>
  );
}
