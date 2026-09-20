import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canSee } from '@/lib/menu';

/**
 * PŘEHLEDY (zadání 20. 9. 2026: „pojďme pro to udělat samostatnou kategorii
 * na hlavním panelu s názvem Přehledy").
 *
 * Rozcestník pro analytické pohledy nad portálem. Zatím je tu Kapacita
 * studií; další přehledy přibydou sem, ne do menu - lišta má zůstat krátká.
 */
export const dynamic = 'force-dynamic';

const PREHLEDY = [
  {
    href: '/prehledy/kapacita',
    nazev: 'Kapacita studií',
    popis: 'Mapa obsazenosti studií natáčením po měsících — kolik hodin se točí a kolik místa zbývá.',
  },
];

export default async function PrehledyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (!canSee('/prehledy', session.user.role)) redirect('/projekty');

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Přehledy</h1>
        <p className="text-muted font-body m-0 mt-2">
          Souhrnné pohledy nad tím, co se v portálu děje. Data se berou živě z kalendáře a projektů.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PREHLEDY.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="bg-surface rounded-card border border-line shadow-sm p-5 no-underline hover:border-brand-purple transition-colors"
          >
            <p className="font-heading font-semibold text-ink m-0">{p.nazev}</p>
            <p className="text-sm font-body text-muted m-0 mt-1">{p.popis}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
