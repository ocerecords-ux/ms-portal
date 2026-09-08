import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

// Ukoly na profilu clena tymu Mediaspace (zadani 5. 9. 2026).
//
// Uzivatel se bere VZDY ze session - v tele pozadavku zadne userId
// neprijimame, takze nikdo nemuze zalozit ani precist ukol nekoho jineho.
const schema = z.object({
  title: z.string().trim().min(1, 'Napište, co je potřeba udělat.').max(300),
  dueDate: z.string().trim().min(8).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    let dueDate: Date | null = null;
    if (parsed.data.dueDate) {
      const parsedDate = new Date(`${parsed.data.dueDate}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Neplatný termín.' }, { status: 400 });
      }
      dueDate = parsedDate;
    }

    const last = await prisma.task.findFirst({
      where: { userId: session.user.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        title: parsed.data.title,
        dueDate,
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error('POST /api/tasks selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
