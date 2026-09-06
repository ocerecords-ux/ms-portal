import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Smazani vykazu. Zvukar smi mazat jen svoje, admin cokoliv.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });

    const entry = await prisma.timesheetEntry.findUnique({ where: { id: params.id } });
    if (!entry) return NextResponse.json({ error: 'Výkaz nenalezen.' }, { status: 404 });

    const isOwner = entry.userId === session.user.id;
    if (!isOwner && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Můžete mazat jen svoje výkazy.' }, { status: 403 });
    }

    await prisma.timesheetEntry.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/timesheets/[id] selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}
