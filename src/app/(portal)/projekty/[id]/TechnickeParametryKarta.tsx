import Link from 'next/link';
import { VypisParametru } from '@/app/(portal)/components/VypisParametru';
import type { ParametryProjektu } from '@/lib/technickeParametryServer';

/**
 * TECHNICKÉ PARAMETRY V KARTĚ PROJEKTU (zadání 27. 9. 2026: „uvidí to v kartě
 * projektu").
 *
 * Jen ke čtení - upravuje se to na jednom místě v Administraci, aby změna
 * platila pro všechny projekty té firmy. Kdo na to právo má, má tu rovnou
 * proklik; ostatní vidí jen, odkud parametry jsou.
 */
export function TechnickeParametryKarta({
  parametry,
  smiMenit,
}: {
  parametry: ParametryProjektu;
  smiMenit: boolean;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-base text-ink m-0">Technické parametry</h2>
        <span className="text-xs font-body text-muted">
          {parametry.profil.nazev}
          {parametry.vychoziSada && ' — obecná sada, firma vlastní nemá'}
        </span>
        {smiMenit && (
          <Link
            href="/admin/technicke-parametry"
            className="ml-auto text-xs font-heading text-brand-purple no-underline hover:underline"
          >
            Upravit sady
          </Link>
        )}
      </div>
      {parametry.profil.perex && (
        <p className="text-xs font-body text-muted m-0">{parametry.profil.perex}</p>
      )}
      <VypisParametru sekce={parametry.sekce} />
    </section>
  );
}
