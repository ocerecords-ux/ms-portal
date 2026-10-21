import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { authOptions } from '@/lib/auth';
import { nactiZminky, smiPoslatPribeh } from '@/lib/pribehyServer';

/**
 * ZMÍNKY, KTERÉ UŽ NĚKDO POUŽIL (zadání 6. 10. 2026: „kdyby tam šli označit
 * lidi přes zavináč").
 *
 * Nabídka se staví z textů minulých příběhů - vlastní tabulka účtů by se
 * stejně nikdy neudržovala a seznam lidí v portálu s instagramovými
 * přezdívkami nijak nesouvisí.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const kdo = { id: session.user.id, role: session.user.role };
  if (!(await smiPoslatPribeh(kdo))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  return NextResponse.json({ zminky: await nactiZminky() });
}
