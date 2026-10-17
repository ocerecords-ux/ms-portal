import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { podepsanyUploadObaluHudby } from '@/lib/storage';

/** Adresa na nahrání obalu skladby série - viz hudba/obal-podpis u projektu. */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const podpis = await podepsanyUploadObaluHudby('obal');
  if (!podpis) {
    return NextResponse.json({ error: 'Úložiště není nastavené.' }, { status: 503 });
  }
  return NextResponse.json(podpis);
}
