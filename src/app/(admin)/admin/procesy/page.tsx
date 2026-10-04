import Link from 'next/link';
import { prisma } from '@/lib/db';
import { nazevRole } from '@/lib/roles';
import type { Role } from '@prisma/client';
import { nactiJazyk } from '@/lib/jazykServer';
import { kodJazyka, prelozit, prelozitS } from '@/lib/jazyk';
import { NovyClanekButton } from '../navody/NovyNavodButton';
import { NacistParametry } from './NacistParametry';

/**
 * SPRÁVA PROCESŮ (zadání 28. 9. 2026: „pracovní postupy pro zvukaře…
 * u každého článku by mělo jít nastavit, kdo ho vidí").
 *
 * Psací strana; čte se v portálu na /procesy. Editor je společný s návody -
 * je to tentýž model, liší se jen druhem (viz lib/navody.ts).
 */
export const dynamic = 'force-dynamic';

export default async function ProcesyAdminPage() {
  const jazyk = nactiJazyk();
  const clanky = (await prisma.navod
    .findMany({
      where: { druh: 'PROCES' },
      orderBy: [{ kategorie: 'asc' }, { poradi: 'asc' }, { nazev: 'asc' }],
      select: {
        id: true,
        slug: true,
        nazev: true,
        kategorie: true,
        zverejneno: true,
        proRole: true,
        updatedAt: true,
      },
    })
    .catch(() => [])) as {
    id: string;
    slug: string;
    nazev: string;
    kategorie: string;
    zverejneno: boolean;
    proRole: string[];
    updatedAt: Date;
  }[];

  return (
    <section className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="hidden sm:block font-display text-3xl text-ink m-0">
            {prelozit(jazyk, 'procesy.nadpis')}
          </h1>
          <p className="text-sm font-body text-muted m-0 mt-1 max-w-[60ch]">
            {prelozit(jazyk, 'procesyAdmin.uvod')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Technické parametry se sem přepisují z Administrace (28. 9. 2026:
              „do těch procesů ulož technické parametry") - sada zůstává jedním
              zdrojem pravdy, tohle je její otisk ke čtení. */}
          <NacistParametry />
          <NovyClanekButton druh="PROCES" popisek={prelozit(jazyk, 'procesyAdmin.novy')} />
        </div>
      </div>

      {clanky.length === 0 && (
        <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'procesyAdmin.prazdno')}</p>
      )}

      <div className="flex flex-col gap-2">
        {clanky.map((c) => (
          <Link
            key={c.id}
            href={`/admin/navody/${c.id}`}
            className="rounded-card border border-line bg-surface p-4 no-underline transition-colors hover:border-brand-purple"
          >
            <span className="flex items-baseline gap-2 flex-wrap">
              <span className="font-heading font-semibold text-sm text-ink">{c.nazev}</span>
              <span className="text-xs font-body text-muted">{c.kategorie}</span>
              {!c.zverejneno && (
                <span className="text-[10px] font-heading uppercase tracking-wide text-muted border border-line rounded-pill px-2 py-0.5">
                  {prelozit(jazyk, 'procesy.rozepsane')}
                </span>
              )}
            </span>
            <span className="block text-xs font-body text-muted mt-1">
              {prelozit(jazyk, 'procesyAdmin.pro')}
              {(c.proRole ?? []).length
                ? c.proRole.map((r) => nazevRole(r as Role, jazyk)).join(', ')
                : prelozit(jazyk, 'procesyAdmin.celyTym')}
              {prelozitS(jazyk, 'procesyAdmin.upraveno', {
                datum: c.updatedAt.toLocaleDateString(kodJazyka(jazyk), {
                  timeZone: 'Europe/Prague',
                }),
              })}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
