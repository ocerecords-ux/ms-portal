import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { maPristup } from '@/lib/pristupy';

/** Spolecna kontrola pro vsechny /api/admin/* routy. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }
  return session;
}

/**
 * KDO SMÍ SÁHNOUT NA KARTU HERCE (zadání 20. 10. 2026: „Helča by měla vidět
 * uživatele - herce. Ostatní uživatele by ale neměla mít právo měnit").
 *
 * Vrací `jenHerci: true` tam, kde to není Žůžo-labůžo - volající pak musí
 * ověřit, že ten konkrétní účet JE herec. Bez toho by právo na karty herců
 * otevřelo celou správu uživatelů.
 */
export async function requireSpravuHercu() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (session.user.role === 'ADMIN') return { session, jenHerci: false };

  const ucet = (await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { role: true, pristupy: true, superadmin: true },
    })
    .catch(() => null)) as { role: string; pristupy: string[]; superadmin: boolean } | null;
  if (!ucet) return null;

  const smi = maPristup(
    { role: ucet.role, superadmin: ucet.superadmin, pristupy: ucet.pristupy ?? [] },
    'HERCI.UPRAVY',
  );
  return smi ? { session, jenHerci: true } : null;
}
