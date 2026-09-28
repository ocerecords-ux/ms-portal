import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ROLE_LABELS } from '@/lib/roles';
import type { Role } from '@prisma/client';
import { NovyClanekButton } from '../navody/NovyNavodButton';

/**
 * SPRÁVA PROCESŮ (zadání 28. 9. 2026: „pracovní postupy pro zvukaře…
 * u každého článku by mělo jít nastavit, kdo ho vidí").
 *
 * Psací strana; čte se v portálu na /procesy. Editor je společný s návody -
 * je to tentýž model, liší se jen druhem (viz lib/navody.ts).
 */
export const dynamic = 'force-dynamic';

export default async function ProcesyAdminPage() {
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
          <h1 className="hidden sm:block font-display text-3xl text-ink m-0">Procesy</h1>
          <p className="text-sm font-body text-muted m-0 mt-1 max-w-[60ch]">
            Pracovní postupy, technické specifikace a návody k programům. U každého článku se
            zaškrtne, kdo ho uvidí — bez zaškrtnutí ho má celý tým. Čte se v portálu pod Procesy.
          </p>
        </div>
        <NovyClanekButton druh="PROCES" popisek="+ Nový proces" />
      </div>

      {clanky.length === 0 && (
        <p className="text-sm font-body text-muted m-0">Zatím tu není žádný postup.</p>
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
                  rozepsané
                </span>
              )}
            </span>
            <span className="block text-xs font-body text-muted mt-1">
              Pro{' '}
              {(c.proRole ?? []).length
                ? c.proRole.map((r) => ROLE_LABELS[r as Role] ?? r).join(', ')
                : 'celý tým'}{' '}
              · upraveno {c.updatedAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
