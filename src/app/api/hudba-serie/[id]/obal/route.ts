import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { obalSkladbySerie } from '@/lib/hudbaSerieServer';
import { isInternalRole } from '@/lib/roles';
import { podepsanyOdkazNaPrilohu } from '@/lib/storage';

/** Obal skladby série - viz obal u projektu; úložiště je soukromé. */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return new NextResponse(null, { status: 403 });
  }
  const { id } = await params;
  const klic = await obalSkladbySerie(id);
  if (!klic) return new NextResponse(null, { status: 404 });
  const odkaz = await podepsanyOdkazNaPrilohu(klic, 'obal.jpg');
  if (!odkaz) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(odkaz);
}
