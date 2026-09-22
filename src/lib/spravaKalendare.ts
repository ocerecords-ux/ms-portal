import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import type { Role } from '@prisma/client';

/**
 * KDO SMÍ UPRAVOVAT KALENDÁŘ KTERÉHO STUDIA (zadání 22. 9. 2026: „Tomáš
 * Ilavský by měl mít přístup k úpravám i brněnských kalendářů. Je to vedoucí
 * pobočky. A to samé Ondřej Černý ml. v Praze").
 *
 * Produkce a Žůžo-labůžo smí všude. Vedoucí pobočky (zaškrtává se na kartě
 * uživatele) smí ve svých studiích - a v jejich místnostech. Ostatní nikde.
 *
 * `'vse'` = všechna studia, jinak seznam id.
 */
export type SpravovanaStudia = 'vse' | string[];

export async function spravovanaStudia(userId: string, role: Role): Promise<SpravovanaStudia> {
  if (canManageCalendar(role)) return 'vse';
  try {
    const ucet = await prisma.user.findUnique({
      where: { id: userId },
      select: { vedeStudia: { select: { id: true, rooms: { select: { id: true } } } } },
    });
    const studia = (ucet?.vedeStudia ?? []) as { id: string; rooms: { id: string }[] }[];
    return studia.flatMap((s) => [s.id, ...s.rooms.map((r) => r.id)]);
  } catch (err) {
    console.error('Vedená studia se nepodařilo načíst:', err);
    return [];
  }
}

export function smiStudio(sprava: SpravovanaStudia, studioId: string | null | undefined): boolean {
  if (sprava === 'vse') return true;
  return Boolean(studioId) && sprava.includes(studioId as string);
}

export function spravujeNeco(sprava: SpravovanaStudia): boolean {
  return sprava === 'vse' || sprava.length > 0;
}
