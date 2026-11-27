import { prisma } from '@/lib/db';
import { rezimZHodnoty, vanocniVyzdoba, type RezimVanoc } from '@/lib/vanoce';

/**
 * Vánoční výzdoba pro konkrétní účet - serverová část (27. 11. 2026).
 * Čte dva vypínače: jeden pro celý portál (správce) a jeden u člověka.
 */

/** Režim celého portálu. Prázdná tabulka = „auto", tedy podle data. */
export async function rezimVanocPortalu(): Promise<RezimVanoc> {
  try {
    const radek = (await prisma.nastaveniVanoc.findUnique({
      where: { id: 'vychozi' },
      select: { rezim: true },
    })) as { rezim: string } | null;
    return rezimZHodnoty(radek?.rezim);
  } catch {
    // Tabulka ještě nemusí existovat (první nasazení) - to není důvod
    // rozsvítit chybu přes celý portál.
    return 'auto';
  }
}

/** Má tenhle člověk vidět výzdobu? */
export async function maVanocniVyzdobu(userId: string): Promise<boolean> {
  try {
    const [uzivatel, rezim] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { vanoceVypnute: true },
      }) as Promise<{ vanoceVypnute: boolean | null } | null>,
      rezimVanocPortalu(),
    ]);
    return vanocniVyzdoba({
      rezim,
      vypnutoUzivateli: uzivatel?.vanoceVypnute ?? false,
    });
  } catch (err) {
    console.error('Vánoční výzdobu se nepodařilo zjistit:', err);
    return false;
  }
}

/** Přepnutí režimu celého portálu - jen pro správce (hlídá si routa). */
export async function nastavVanocePortalu(rezim: RezimVanoc, jmeno: string | null): Promise<void> {
  await prisma.nastaveniVanoc.upsert({
    where: { id: 'vychozi' },
    create: { id: 'vychozi', rezim, zmenilJmeno: jmeno },
    update: { rezim, zmenilJmeno: jmeno },
  });
}
