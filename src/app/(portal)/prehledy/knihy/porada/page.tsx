import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiProgramSPoznamkami } from '@/lib/poradaServer';
import { Rezie } from './Rezie';

/**
 * REŽIE TECHNICKÉ PORADY (zadání 28. 9. 2026) - stránka, kterou má vedoucí
 * u sebe, zatímco na plátně běží přehled v režimu porady.
 *
 * Vlastní adresa schválně: aby se dala otevřít na telefonu nebo v druhém okně
 * nezávisle na tom, co je zrovna na plátně.
 */
export const dynamic = 'force-dynamic';

export default async function PoradaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/prehledy');

  return <Rezie temata={await nactiProgramSPoznamkami()} />;
}
