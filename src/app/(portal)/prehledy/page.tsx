import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { smiNaPalubovku } from '@/lib/palubovkaServer';
import { mujPodilNaObratu } from '@/lib/bonusObratuServer';
import { ZALOZKY_PREHLEDU } from './zalozky';
import { poradiZalozek } from '@/lib/zalozkyServer';
import { seradZalozky } from '@/lib/zalozky';

/**
 * Přehledy nemají rozcestník - otevře se rovnou první záložka (zadání
 * 20. 9. 2026: „z něj pak uděláme záložku, ne toto").
 *
 * PRVNÍ ZÁLOŽKA NENÍ PRO KAŽDÉHO STEJNÁ (zadání 27. 9. 2026: „ať je to první,
 * co se mi ukáže, když otevřu přehledy"). Kdo má Palubovku, otevře se mu
 * rovnou; komu se nezobrazuje, ten by jinak skončil na prázdné stránce, takže
 * se přeskočí na první záložku, na kterou má právo.
 *
 * A od 29. 9. 2026 rozhoduje i vlastní pořadí záložek: kdo si lištu srovnal
 * po svém, tomu se otevře to, co si dal první. Jinak by si člověk záložku
 * přetáhl dopředu a /prehledy by ho dál posílalo jinam.
 */
export default async function PrehledyPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  const palubovka = await smiNaPalubovku(session?.user?.id);
  const podil = session?.user?.id ? await mujPodilNaObratu(session.user.id) : null;
  const bonusy = role === 'ADMIN' || podil !== null;

  const dostupne = ZALOZKY_PREHLEDU.filter(
    (z) =>
      (!z.role || (role && z.role.includes(role))) &&
      (z.jenSPriznakem !== 'palubovka' || palubovka) &&
      (z.jenSPriznakem !== 'bonusy' || bonusy),
  ).map((z) => ({ ...z, klic: z.href }));

  const prvni = seradZalozky(dostupne, await poradiZalozek('prehledy'))[0];
  redirect(prvni?.href ?? '/projekty');
}
