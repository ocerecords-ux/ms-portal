import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { smiNaPalubovku } from '@/lib/palubovkaServer';
import { ZALOZKY_PREHLEDU } from './zalozky';

/**
 * Přehledy nemají rozcestník - otevře se rovnou první záložka (zadání
 * 20. 9. 2026: „z něj pak uděláme záložku, ne toto").
 *
 * PRVNÍ ZÁLOŽKA NENÍ PRO KAŽDÉHO STEJNÁ (zadání 27. 9. 2026: „ať je to první,
 * co se mi ukáže, když otevřu přehledy"). Kdo má Palubovku, otevře se mu
 * rovnou; komu se nezobrazuje, ten by jinak skončil na prázdné stránce, takže
 * se přeskočí na první záložku, na kterou má právo.
 */
export default async function PrehledyPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  const palubovka = await smiNaPalubovku(session?.user?.id);

  const prvni = ZALOZKY_PREHLEDU.find(
    (z) =>
      (!z.role || (role && z.role.includes(role))) &&
      (z.jenSPriznakem !== 'palubovka' || palubovka),
  );
  redirect(prvni?.href ?? '/projekty');
}
