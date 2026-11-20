import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cenikyProDoklady } from '@/lib/cenikProDokladServer';

/**
 * Ceníky k vložení do dokladu (zadání 19. 11. 2026). Jen čtení - vrací to, co
 * smí ten, kdo se ptá: Žůžo-labůžo všechna studia, vedoucí pobočky to své.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  const ceniky = await cenikyProDoklady(session.user.id, session.user.role as never);
  return NextResponse.json({ ceniky });
}
