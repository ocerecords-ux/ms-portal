import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { nactiPrezentaceProjektu, zalozPrezentaci } from '@/lib/prezentaceServer';

/** Nabídkové prezentace u projektu - seznam a založení nové (11. 10. 2026). */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  return NextResponse.json({ prezentace: await nactiPrezentaceProjektu(params.id) });
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const id = await zalozPrezentaci(params.id, session.user.id);
  if (!id) return NextResponse.json({ error: 'Prezentaci se nepodařilo založit.' }, { status: 500 });
  return NextResponse.json({ id, prezentace: await nactiPrezentaceProjektu(params.id) });
}
