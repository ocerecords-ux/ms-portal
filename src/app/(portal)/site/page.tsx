import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiPrispevky, smiSite } from '@/lib/socialniServer';
import { SitePrehled } from './SitePrehled';

/**
 * SÍTĚ (zadání 27. 9. 2026: „chci teď udělat pro sebe modul pro sociální sítě
 * Instagram a LinkedIn. Zatím uvidím jen já a aby tam bylo něco jako Canva").
 *
 * Modul vidí jen ten, kdo má na kartě zapnuté `vidiSite` - ne celá role
 * ADMIN. Kdyby to viselo na roli, uviděla by to i Žůžo-labůžo.
 */
export const dynamic = 'force-dynamic';

export default async function SitePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(await smiSite(session.user.id))) redirect('/projekty');

  return <SitePrehled prispevky={await nactiPrispevky(session.user.id)} />;
}
