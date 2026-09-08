import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEFAULT_HOURLY_RATE, durationMinutes, parseTime, requiresProject } from '@/lib/timesheets';

// Vykazy zvukaru (zadani 6. 9. 2026).
//
// Zapisovat smi jen ZVUKAR (svoje vykazy) a ADMIN. Uzivatel se bere VZDY ze
// session - v tele pozadavku zadne userId neprijimame, aby nesel zapsat vykaz
// za nekoho jineho.
//
// Datum, cas od-do, druh prace a projekt jsou povinne (zadani 6. 9. 2026:
// "čas, druh práce a projekt by měly být povinné údaje") - formular je hlida
// uz v prohlizeci, tady je stejna kontrola znovu.
const schema = z
  .object({
    date: z.string().trim().min(8, 'Vyberte datum.'),
    from: z.string().trim().min(1, 'Vyplňte čas od.'),
    to: z.string().trim().min(1, 'Vyplňte čas do.'),
    workType: z.enum(['RECORDING', 'EDITING', 'OTHER'], {
      errorMap: () => ({ message: 'Vyberte druh práce.' }),
    }),
    caflouProjectId: z.string().trim().optional(),
    projectName: z.string().trim().optional(),
    note: z.string().trim().max(500).optional(),
  })
  // Projekt je povinny u vsech druhu prace krome "Ostatni" (zadani
  // 8. 9. 2026) - tam se ve formulari vubec nevybira.
  .refine((v) => !requiresProject(v.workType) || Boolean(v.projectName), {
    message: 'Vyberte projekt.',
    path: ['projectName'],
  });

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== 'ZVUKAR' && role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Nemáte oprávnění zapisovat výkazy.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    const startMinutes = parseTime(data.from);
    const endMinutes = parseTime(data.to);
    if (startMinutes === null || endMinutes === null) {
      return NextResponse.json({ error: 'Čas zadejte ve tvaru HH:MM.' }, { status: 400 });
    }
    if (startMinutes === endMinutes) {
      return NextResponse.json({ error: 'Začátek a konec nemůžou být stejné.' }, { status: 400 });
    }
    if (durationMinutes(startMinutes, endMinutes) > 16 * 60) {
      return NextResponse.json({ error: 'Výkaz delší než 16 hodin vypadá jako překlep.' }, { status: 400 });
    }

    const date = new Date(`${data.date}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Neplatné datum.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { hourlyRate: true },
    });

    const entry = await prisma.timesheetEntry.create({
      data: {
        userId: session.user.id,
        date,
        startMinutes,
        endMinutes,
        workType: data.workType,
        caflouProjectId: requiresProject(data.workType) ? data.caflouProjectId || null : null,
        projectName: requiresProject(data.workType) ? data.projectName || null : null,
        hourlyRateSnapshot: user?.hourlyRate ?? DEFAULT_HOURLY_RATE,
        note: data.note || null,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error('POST /api/timesheets selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
