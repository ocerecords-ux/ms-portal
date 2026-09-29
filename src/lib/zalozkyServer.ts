import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Uložené pořadí záložek přihlášeného člověka (zadání 29. 9. 2026).
 *
 * Čte se na serveru, aby se lišta vykreslila rovnou správně. Kdyby se
 * dorovnávala až v prohlížeči, záložky by při každém načtení stránky
 * poskočily.
 *
 * Když se čtení nepovede (nepřihlášený, výpadek databáze), vrátí se prázdné
 * pole a lišta zůstane ve výchozím pořadí z kódu. Kvůli pořadí záložek nemá
 * stránka padat.
 */
export async function poradiZalozek(sekce: string): Promise<string[]> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return [];
    const radek = await prisma.userZalozky.findUnique({
      where: { userId_sekce: { userId: session.user.id, sekce } },
      select: { poradi: true },
    });
    return radek?.poradi ?? [];
  } catch {
    return [];
  }
}
