import { prisma } from '@/lib/db';
import { canSee } from '@/lib/menu';
import type { KdoPristupy } from '@/lib/pristupy';

/**
 * PRÁVO NA STRÁNKU PODLE KARTY UŽIVATELE (6. 10. 2026).
 *
 * `canSee` z lib/menu.ts umí rozhodovat podle zaškrtávátek z lib/pristupy.ts,
 * ale musí dostat, co ten člověk má zaškrtnuté. Stránky a routy, které si pro
 * to nesáhly do databáze, se dál ptaly jen role - a kdo dostal sekci
 * zaškrtávátkem, stejně skončil na „nemáte oprávnění" (28. 9. 2026 se tím
 * změnilo pravidlo, kontroly u jednotlivých stránek se za ním doplňují
 * postupně).
 *
 * Čte se z databáze, ne ze session: práva se mění na kartě uživatele
 * a nikdo se kvůli nim nebude odhlašovat.
 *
 * NIKDY NEVYHAZUJE: když databáze neodpoví, rozhodne role jako dřív -
 * výpadek spojení nemá nikomu brát přístup.
 */
export async function smiNaStranku(
  user: { id: string; role: string },
  href: string,
): Promise<boolean> {
  let kdo: KdoPristupy | undefined;
  try {
    const ucet = (await prisma.user.findUnique({
      where: { id: user.id },
      select: { superadmin: true, pristupy: true },
    })) as { superadmin: boolean | null; pristupy: string[] | null } | null;
    if (ucet) {
      kdo = { role: user.role, superadmin: ucet.superadmin ?? false, pristupy: ucet.pristupy ?? [] };
    }
  } catch (err) {
    console.error('Přístupy uživatele se nepodařilo načíst:', err);
  }
  return canSee(href, user.role as never, kdo);
}
