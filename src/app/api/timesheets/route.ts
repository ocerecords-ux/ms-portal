import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEFAULT_HOURLY_RATE } from '@/lib/timesheets';
import { polozkyVykazu, schemaVykazu } from '@/lib/timesheetyVstup';
import { hlaskaOKolizi, najdiKolizi } from '@/lib/timesheetyKolize';

// Vykazy zvukaru (zadani 6. 9. 2026).
//
// Zapisovat smi jen ZVUKAR (svoje vykazy) a ADMIN. Uzivatel se bere VZDY ze
// session - v tele pozadavku zadne userId neprijimame, aby nesel zapsat vykaz
// za nekoho jineho.
//
// Kontrola vstupu je v lib/timesheetyVstup.ts, protoze stejna pravidla plati
// i pro upravu vykazu (PATCH v [id]/route.ts).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== 'ZVUKAR' && role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Nemáte oprávnění zapisovat výkazy.' }, { status: 403 });
    }

    const parsed = schemaVykazu.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const pripraveno = polozkyVykazu(parsed.data);
    if (!pripraveno.ok) {
      return NextResponse.json({ error: pripraveno.chyba }, { status: 400 });
    }

    // Dvakrat tentyz vykaz (zadani 16. 9. 2026) - jinak se mesic vyfakturuje
    // dvakrat a nikdo si toho nevsimne.
    const kolize = await najdiKolizi(session.user.id, pripraveno.data);
    if (kolize) {
      return NextResponse.json({ error: hlaskaOKolizi(kolize) }, { status: 409 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { hourlyRate: true },
    });

    const entry = await prisma.timesheetEntry.create({
      data: {
        userId: session.user.id,
        ...pripraveno.data,
        hourlyRateSnapshot: user?.hourlyRate ?? DEFAULT_HOURLY_RATE,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error('POST /api/timesheets selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
