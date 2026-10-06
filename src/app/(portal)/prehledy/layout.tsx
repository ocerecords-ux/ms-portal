import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { smiNaPalubovku } from '@/lib/palubovkaServer';
import { mujPodilNaObratu } from '@/lib/bonusObratuServer';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { ZalozkyPrehledu } from './ZalozkyPrehledu';

/**
 * PŘEHLEDY (zadání 20. 9. 2026) - společná hlavička sekce se záložkami.
 * Každý přehled je vlastní stránka, takže se dá poslat odkazem i s vybraným
 * měsícem.
 */
export default async function PrehledyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const palubovka = await smiNaPalubovku(session?.user?.id);
  /**
   * Moje bonusy (6. 10. 2026): záložku má ten, kdo nějaký podíl na obratu má,
   * a Žůžo-labůžo - to vidí podíly všech.
   */
  const podil = session?.user?.id ? await mujPodilNaObratu(session.user.id) : null;
  const bonusy = session?.user?.role === 'ADMIN' || podil !== null;
  const jazyk = nactiJazyk();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">{prelozit(jazyk, 'prehledy.nadpis')}</h1>
      <ZalozkyPrehledu role={session?.user?.role ?? null} palubovka={palubovka} bonusy={bonusy} />
      {children}
    </div>
  );
}
