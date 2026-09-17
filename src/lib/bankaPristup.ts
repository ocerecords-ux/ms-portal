import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * KDO SMÍ DO SEKCE BANKA (zadání 17. 9. 2026: „nastavení a párování banky bych
 * měl vidět jen já a Bára Šiblová").
 *
 * Pohyby na účtu jsou citlivější než zbytek dokladů, takže nestačí být
 * Žůžo-labůžo - účet to musí mít výslovně dovolené (příznak `vidiBanku`
 * v Adminu ▸ Uživatelé). Příznak je u účtu schválně: až to bude hlídat někdo
 * jiný, překlikne se to tam a v kódu se nic nemění.
 *
 * Dokud si to nikdo nezaškrtne, sekci nevidí NIKDO - u peněz je lepší, když
 * se přístup musí povolit, než aby se musel zakazovat.
 */
export async function smiDoBanky(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const uzivatel = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, vidiBanku: true },
  });
  return Boolean(uzivatel?.active && uzivatel.vidiBanku);
}
