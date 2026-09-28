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
 * Vybrané období je v adrese, takže se dá přehled poslat odkazem a tlačítko
 * Zpět vrací předchozí měsíc.
 *
 * Jen pro admina - jsou to mzdové údaje celého týmu a marže knih.
 */
export const dynamic = 'force-dynamic';

export default async function KnihyPage({
  searchParams,
}: {
  searchParams?: { obdobi?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/prehledy');

  const zadano = searchParams?.obdobi?.trim() ?? '';
  const obdobi =
    zadano === 'minuly' || zadano === 'vse' || /^\d{4}-\d{2}$/.test(zadano) ? zadano : 'tento';

  const [data, cile] = await Promise.all([
    nactiKnihyUkazatele(new Date(), obdobi),
    nactiCile(),
  ]);

  return <Ukazatele data={data} cile={cile} obdobi={obdobi} />;
}
