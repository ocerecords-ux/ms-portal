import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Zmena a smazani ukolu (zadani 5. 9. 2026). Ukol se vzdy hleda spolu s
// userId ze session - cizi ukol proto nejde ani odskrtnout, ani smazat.
const patchSchema = z.object({
  done: z.boolean().optional(),
  title: z.string().trim().min(1).max(300).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const result = await prisma.task.updateMany({
      where: { id: params.id, userId: session.user.id },
      data: parsed.data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Úkol nenalezen.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/tasks/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const result = await prisma.task.deleteMany({ where: { id: params.id, userId: session.user.id } });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Úkol nenalezen.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tasks/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
