import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiCile } from '@/lib/palubovkaServer';
import { nactiKnihyUkazatele } from '@/lib/knihyPrehledServer';
import { Ukazatele } from './Ukazatele';

/**
 * KNIHY A ROZPOČTY (zadání 28. 9. 2026 pro Petera, zjednodušeno tentýž den:
 * „něco podobného, jako mám palubovku. Jasné ukazatele.").
 *
 * Stránka sama nic nepočítá - ptá se na hotové ukazatele a předá je budíkům.
 * Co který znamená a proč se počítá právě takhle, je v lib/knihyPrehledServer.ts.
 * Původní podoba s filtry, grafy a výpisem výkazů žije dál na /prehledy/knihy/rozpad.
 *
 * Jen pro admina - jsou to mzdové údaje celého týmu a marže knih.
 */
export const dynamic = 'force-dynamic';

export default async function KnihyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/prehledy');

  const [data, cile] = await Promise.all([nactiKnihyUkazatele(new Date()), nactiCile()]);

  return <Ukazatele data={data} cile={cile} />;
}
