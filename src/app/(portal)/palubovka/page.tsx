import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiCile, nactiPalubovku, smiNaPalubovku } from '@/lib/palubovkaServer';
import { Palubovka } from './Palubovka';

/**
 * PALUBOVKA (zadání 27. 9. 2026: „vidím jen já a tím řídím celou firmu").
 *
 * Obrat, cíle a rozjednané zakázky nepatří nikomu dalšímu, takže nestačí role
 * - účet to musí mít dovolené příznakem `vidiPalubovku`. Stejný princip jako
 * u Banky a Sítí: kdyby to viselo na roli ADMIN, viděla by to celá
 * Žůžo-labůžo.
 */
export const dynamic = 'force-dynamic';

export default async function PalubovkaPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(await smiNaPalubovku(session.user.id))) redirect('/projekty');

  const dnes = new Date();
  const [data, cile] = await Promise.all([nactiPalubovku(dnes), nactiCile()]);

  return <Palubovka data={data} cile={cile} dnesISO={dnes.toISOString()} />;
}
