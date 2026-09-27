import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiCile, nactiPalubovku, smiNaPalubovku } from '@/lib/palubovkaServer';
import { Palubovka } from '@/app/(portal)/palubovka/Palubovka';

/**
 * PALUBOVKA JAKO PRVNÍ ZÁLOŽKA PŘEHLEDŮ (zadání 27. 9. 2026: „dej mi to do
 * přehledu na novou kartu. Ale ať je to první, co se mi ukáže, když otevřu
 * přehledy").
 *
 * Obsah je tentýž jako na samostatné stránce /palubovka - komponenta je jedna,
 * ať se ty dvě cesty nikdy nerozejdou. Zámek je taky tentýž: příznak
 * `vidiPalubovku` na kartě, ne role.
 */
export const dynamic = 'force-dynamic';

export default async function PalubovkaZalozka() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!(await smiNaPalubovku(session.user.id))) redirect('/prehledy');

  const dnes = new Date();
  const [data, cile] = await Promise.all([nactiPalubovku(dnes), nactiCile()]);

  return <Palubovka data={data} cile={cile} dnesISO={dnes.toISOString()} vZalozce />;
}
