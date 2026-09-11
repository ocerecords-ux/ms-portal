import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

/**
 * Kdo smí k přeposlechu daného projektu (zadání 11. 9. 2026).
 *
 * Tým Mediaspace ke všem projektům. Klient jen k projektům své firmy - odkaz
 * z mailu ho dovede na celoobrazovkový přeposlech, takže tudy tečou nahrávky
 * ven a kontrola je tu pokaždé, ne jen při prvním otevření.
 */
export async function pristupKPreposlechu(caflouProjectId: string): Promise<
  | { ok: true; userId: string; jmeno: string | null; interni: boolean }
  | { ok: false; status: 401 | 403; message: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, status: 401, message: 'Nepřihlášeno.' };
  }

  const jmeno = session.user.name || session.user.email || null;
  if (isInternalRole(session.user.role)) {
    return { ok: true, userId: session.user.id, jmeno, interni: true };
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return { ok: false, status: 403, message: 'Účet není napojený na firmu.' };
  }

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { companyId: true },
  });
  if (!meta?.companyId || meta.companyId !== companyId) {
    return { ok: false, status: 403, message: 'K tomuto projektu nemáte přístup.' };
  }

  return { ok: true, userId: session.user.id, jmeno, interni: false };
}
