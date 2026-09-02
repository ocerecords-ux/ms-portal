import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/** Spolecna kontrola pro vsechny /api/admin/* routy. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }
  return session;
}
