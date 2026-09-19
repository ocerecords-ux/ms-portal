import type { Role } from '@prisma/client';
import { ROLE_LABELS } from '@/lib/roles';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { NovyNavodButton } from './NovyNavodButton';

/**
 * SPRÁVA NÁVODŮ (zadání 16. 9. 2026: „udělejme nějakou přehlednou sekci a tam
 * budeme vše postupně přidávat").
 *
 * Tohle je psací strana; čtecí je /napoveda a vidí ji celý tým.
 */
export const dynamic = 'force-dynamic';

export default async function NavodyPage() {
  const navody = await prisma.navod
    .findMany({
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
    .catch(() => []);

  return (
    <section className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink m-0">Návody</h1>
          <p className="text-sm font-body text-muted m-0 mt-1">
            Co je tu zveřejněné, najde celý tým v Nápovědě — včetně hledání v textu.
          </p>
        </div>
        <NovyNavodButton />
      </div>

      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        {navody.length === 0 ? (
          <p className="text-sm font-body text-muted m-0 px-5 py-6">
            Zatím tu žádný návod není.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {navody.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <Link
                  href={`/admin/navody/${n.id}`}
                  className="flex items-center gap-3 px-5 py-3 no-underline hover:bg-field flex-wrap"
                >
                  <span className="text-xs font-heading uppercase tracking-wide text-muted w-36 shrink-0">
                    {n.kategorie}
                  </span>
                  <span className="font-heading font-semibold text-ink flex-1 min-w-[160px]">
                    {n.nazev}
                    {/* Bez zaskrtnute role je navod jen pro tym (19. 9. 2026). */}
                    <span className="block text-xs font-body text-muted">
                      {n.proRole.length > 0
                        ? `jen pro: ${n.proRole.map((r) => ROLE_LABELS[r as Role] ?? r).join(', ')}`
                        : 'jen náš tým - herci a klienti nevidí'}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-heading rounded-pill border px-2.5 py-1 ${
                      n.zverejneno
                        ? 'border-brand-green text-brand-greenDeep'
                        : 'border-line text-muted'
                    }`}
                  >
                    {n.zverejneno ? 'Zveřejněno' : 'Rozepsané'}
                  </span>
                  <span className="text-xs font-body text-muted w-24 text-right">
                    {n.updatedAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs font-body text-muted m-0">
        Obrázky do návodu se nahrávají do složky <code>public/navody/</code> a v textu se na ně
        odkazuje jako <code>![popis](/navody/soubor.png)</code>.
      </p>
    </section>
  );
}
