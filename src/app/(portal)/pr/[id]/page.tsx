import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { nactiKampan, nactiMedia, nactiUkoly } from '@/lib/emaServer';
import { prelozit } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';
import { isInternalRole } from '@/lib/roles';

import { KampanDetail } from './KampanDetail';

/** Jedna kampaň: zadání pro Emu, její výstupy a seznam médií (19. 11. 2026). */
export const dynamic = 'force-dynamic';

export default async function KampanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (!isInternalRole(session.user.role)) redirect('/projekty');

  const { id } = await params;
  const jazyk = nactiJazyk();
  const kampan = await nactiKampan(id);
  if (!kampan) {
    notFound();
    return null;
  }

  return (
    <main className="p-4 sm:p-6 flex flex-col gap-5 max-w-[1100px]">
      <Link href="/pr" className="text-sm font-heading text-muted no-underline hover:text-ink">
        ← {prelozit(jazyk, 'pr.zpet')}
      </Link>
      <KampanDetail
        jazyk={jazyk}
        kampan={kampan}
        pocatecniUkoly={await nactiUkoly(id)}
        pocatecniMedia={await nactiMedia(id)}
      />
    </main>
  );
}
