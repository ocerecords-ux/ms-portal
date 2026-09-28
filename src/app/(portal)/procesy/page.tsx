import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { vidiNavod } from '@/lib/navody';
import { OzubeneKolo } from '@/components/OzubeneKolo';

/**
 * PROCESY - naše pracovní postupy (zadání 28. 9. 2026: „udělejme novou sekci
 * Procesy, kde budeme postupně dávat pracovní postupy pro zvukaře. Budou tam
 * i ty technické specifikace").
 *
 * PROČ ZVLÁŠŤ OD NÁPOVĚDY: Nápověda je o portálu - kde se co klikne. Tohle je
 * o řemesle: jak se natáčí, v čem se odevzdává, co dělat, když se něco stane.
 * Kdo hledá postup k práci, nemá ho lovit mezi návody k tlačítkům.
 *
 * KDO CO VIDÍ, ROZHODUJE ČLÁNEK (zadání: „vidíme primárně jen my s Peterem
 * a zvukaři. Pak budou i dokumenty, které uvidí zase jen Žůžo-labůžo
 * a produkce"). Nic zaškrtnutého = celý tým; zaškrtnuté role = jen ty. Viz
 * vidiNavod v lib/navody.ts, stejné pravidlo jako u nápovědy.
 *
 * Herec ani klient se sem nedostanou vůbec - je to vnitřní kuchyně.
 */
export const dynamic = 'force-dynamic';

export default async function ProcesyPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session.user.role;
  if (!isInternalRole(role)) redirect('/projekty');
  const jeAdmin = role === 'ADMIN';

  const clanky = await prisma.navod
    .findMany({
      where: { druh: 'PROCES', ...(jeAdmin ? {} : { zverejneno: true }) },
      orderBy: [{ kategorie: 'asc' }, { poradi: 'asc' }, { nazev: 'asc' }],
      select: {
        id: true,
        slug: true,
        nazev: true,
        perex: true,
        kategorie: true,
        zverejneno: true,
        proRole: true,
        updatedAt: true,
      },
    })
    .catch(() => []);

  const moje = (clanky as {
    id: string;
    slug: string;
    nazev: string;
    perex: string | null;
    kategorie: string;
    zverejneno: boolean;
    proRole: string[];
    updatedAt: Date;
  }[]).filter((c) => vidiNavod(c.proRole ?? [], role));

  // Seskupení po kategoriích - „Ostatní" na konec, ať nezůstane uprostřed.
  const kategorie = [...new Set(moje.map((c) => c.kategorie))].sort((a, b) =>
    a === 'Ostatní' ? 1 : b === 'Ostatní' ? -1 : a.localeCompare(b, 'cs'),
  );

  return (
    <section className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Procesy</h1>
        {jeAdmin && <OzubeneKolo cesta="/admin/procesy" popis="Psaní a správa procesů" />}
      </div>
      <p className="text-sm font-body text-muted m-0 -mt-3 max-w-[70ch]">
        Jak u nás děláme práci - pracovní postupy, technické specifikace a návody k programům.
        U každého článku je napsané, pro koho je.
      </p>

      {moje.length === 0 && (
        <p className="text-sm font-body text-muted m-0">
          Zatím tu nic není.{' '}
          {jeAdmin ? (
            <Link href="/admin/procesy" className="text-brand-purple no-underline hover:underline">
              Napsat první postup
            </Link>
          ) : (
            'Postupy sem přibudou.'
          )}
        </p>
      )}

      {kategorie.map((k) => (
        <div key={k} className="flex flex-col gap-2">
          <h2 className="font-heading font-semibold text-xs uppercase tracking-wide text-muted m-0">
            {k}
          </h2>
          <div className="flex flex-col gap-2">
            {moje
              .filter((c) => c.kategorie === k)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/procesy/${encodeURIComponent(c.slug)}`}
                  className="rounded-card border border-line bg-surface p-4 no-underline transition-colors hover:border-brand-purple"
                >
                  <span className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-heading font-semibold text-sm text-ink">{c.nazev}</span>
                    {!c.zverejneno && (
                      <span className="text-[10px] font-heading uppercase tracking-wide text-muted border border-line rounded-pill px-2 py-0.5">
                        rozepsané
                      </span>
                    )}
                  </span>
                  {c.perex && (
                    <span className="block text-xs font-body text-muted mt-1">{c.perex}</span>
                  )}
                </Link>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
