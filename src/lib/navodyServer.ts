import { prisma } from '@/lib/db';
import { slugZNazvu } from '@/lib/navody';

/**
 * Práce s návody, která sahá do databáze (zadání 16. 9. 2026).
 *
 * Schválně mimo routy: adresu návodu potřebuje jak zakládání, tak
 * přejmenování, a routa v Next.js nesmí vyvážet nic jiného než své metody -
 * jinak build spadne.
 */

/** Adresa musí být jedinečná — když se název opakuje, přidá se číslo. */
export async function volnySlug(nazev: string, kromeId?: string): Promise<string> {
  const zaklad = slugZNazvu(nazev);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? zaklad : `${zaklad}-${i + 1}`;
    const uz = await prisma.navod.findUnique({ where: { slug }, select: { id: true } });
    if (!uz || uz.id === kromeId) return slug;
  }
  return `${zaklad}-${Date.now()}`;
}
