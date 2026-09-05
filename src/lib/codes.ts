import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';

/**
 * Verejna citelna ID uzivatelu/firem (zadani 5. 9. 2026), oddelene rady
 * podle kategorie - vzdy "MS" + prefix + 4 cislice:
 *   Firmy (Klienti i Dodavatele)         -> MSF0001
 *   Mediaspace (interni tym - ADMIN/ZVUKAR/PRODUKCE) -> MSI0001
 *   Herci                                 -> MSH0001
 *   Klienti (uzivatele s roli CLIENT)     -> MSK0001
 *
 * Cislo se bere atomicky z modelu Counter (radek na prefix), aby se pri
 * soubehu dvou zalozeni nikdy nepouzilo stejne cislo dvakrat - Prisma
 * upsert+increment je jeden UPDATE/INSERT na urovni databaze.
 */
export async function nextCode(prefix: 'F' | 'I' | 'H' | 'K'): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { name: prefix },
    create: { name: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `MS${prefix}${String(counter.value).padStart(4, '0')}`;
}

/** Prefix rady podle role uzivatele - viz nextCode() vyse. */
export function codePrefixForRole(role: Role): 'I' | 'H' | 'K' {
  if (role === 'HEREC') return 'H';
  if (role === 'CLIENT') return 'K';
  return 'I'; // ADMIN, ZVUKAR, PRODUKCE - interni tym Mediaspace
}
