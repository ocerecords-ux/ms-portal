import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canViewCalendar } from '@/lib/roles';
import { nactiHistoriiKalendare } from '@/lib/kalendarLogServer';

/**
 * HISTORIE KALENDÁŘE (zadání 23. 9. 2026: „ještě by to chtělo někam dát
 * historii, kdo kdy upravil nějakou věc v kalendáři").
 *
 * Kdo vidí kalendář, vidí i to, kdo v něm co přehodil - o to v historii jde.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '80');
  const radky = await nactiHistoriiKalendare(Number.isFinite(limit) ? limit : 80);
  return NextResponse.json({ radky });
}
