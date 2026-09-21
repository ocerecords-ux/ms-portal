import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { loadZadaneMnou } from '@/lib/tasksServer';
import { CAS_UKOLU } from '@/lib/terminUkolu';

// Ukoly na profilu clena tymu Mediaspace (zadani 5. 9. 2026).
//
// Uzivatel se bere VZDY ze session - v tele pozadavku zadne userId
// neprijimame, takze nikdo nemuze zalozit ani precist ukol nekoho jineho.
const schema = z.object({
  title: z.string().trim().min(1, 'Napište, co je potřeba udělat.').max(300),
  dueDate: z.string().trim().min(8).nullable().optional(),
  /** „HH:MM" (21. 9. 2026) - jen spolu s datem. */
  dueTime: z.string().trim().regex(CAS_UKOLU, 'Neplatný čas.').nullable().optional(),
});

/**
 * Moje ukoly (zadani 18. 9. 2026: zalozka „Ukoly" primo v chatu).
 *
 * Panel na prave hrane dostava ukoly z layoutu, ale chat na telefonu bezi
 * jako samostatna stranka, kde zadny layout s ukoly neni - proto si je
 * nacita sam. Uzivatel se bere ze session, cizi ukoly se nikam nedostanou.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const tasks = await prisma.task.findMany({
      where: { userId: session.user.id },
      orderBy: [{ done: 'asc' }, { dueDate: 'asc' }, { sortOrder: 'asc' }],
      take: 200,
    });

    // „Zadal jsem" - úkoly, které jsem dal někomu jinému (21. 9. 2026).
    const zadane = await loadZadaneMnou(session.user.id, session.user.role);

    return NextResponse.json({
      zadane,
      ukoly: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        dueTime: t.dueTime ?? null,
        zadalJmeno: t.zadalJmeno ?? null,
      })),
    });
  } catch (err) {
    console.error('GET /api/tasks selhalo:', err);
    return NextResponse.json({ ukoly: [] });
  }
}

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
        // Čas bez data nedává smysl - zahodí se.
        dueTime: dueDate ? parsed.data.dueTime || null : null,
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
