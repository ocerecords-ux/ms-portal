import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEFAULT_HOURLY_RATE } from '@/lib/timesheets';
import { polozkyVykazu } from '@/lib/timesheetyVstup';
import { hlaskaOKolizi, najdiKolizi } from '@/lib/timesheetyKolize';

/**
 * NÁVRH VÝKAZU Z KALENDÁŘE - přidání do výkazu a odmítnutí (zadání
 * 20. 9. 2026).
 *
 * Zvukař si svůj návrh buď PŘIDÁ JAKO VÝKAZ (čas a projekt se dají cestou
 * opravit), nebo ho odloží stranou přes „Nevykazovat". Cizí návrh nikdo
 * neuvidí ani neupraví - bere se vždycky ze session, v těle se uživatel
 * neposílá.
 *
 * Výkaz se zakládá přes stejná pravidla jako ruční zápis (timesheetyVstup
 * a timesheetyKolize), takže i tudy platí „dva výkazy na stejný čas a projekt
 * neprojdou".
 */
const schema = z.object({
  id: z.string().trim().min(1),
  akce: z.enum(['pridat', 'odmitnout']),
  /** Opravený čas a projekt - když je zvukař v řádku změnil. */
  date: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  caflouProjectId: z.string().trim().optional(),
  projectName: z.string().trim().optional(),
});

const PRAHA = 'Europe/Prague';

/** Datum a čas události v pražském čase - do předvyplněného výkazu. */
function vPraze(d: Date): { datum: string; cas: string } {
  const casti = new Intl.DateTimeFormat('en-CA', {
    timeZone: PRAHA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const v = (typ: string) => casti.find((c) => c.type === typ)?.value ?? '';
  return { datum: `${v('year')}-${v('month')}-${v('day')}`, cas: `${v('hour')}:${v('minute')}` };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ZVUKAR') {
      return NextResponse.json({ error: 'Výkazy si píše zvukař.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    const d = parsed.data;

    const navrh = await prisma.navrhVykazu.findUnique({ where: { id: d.id } });
    if (!navrh || navrh.userId !== session.user.id) {
      return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    }
    if (navrh.stav !== 'CEKA') {
      return NextResponse.json({ error: 'Tahle nabídka už je vyřízená.' }, { status: 409 });
    }

    if (d.akce === 'odmitnout') {
      await prisma.navrhVykazu.update({ where: { id: navrh.id }, data: { stav: 'ODMITNUTO' } });
      return NextResponse.json({ ok: true });
    }

    const zacatek = vPraze(navrh.start);
    const konec = vPraze(navrh.end);
    const vstup = {
      date: d.date || zacatek.datum,
      from: d.from || zacatek.cas,
      to: d.to || konec.cas,
      workType: navrh.workType,
      caflouProjectId: d.caflouProjectId || navrh.caflouProjectId || undefined,
      projectName: d.projectName || navrh.projectName || undefined,
    };
    if (!vstup.projectName) {
      return NextResponse.json({ error: 'Vyberte projekt.' }, { status: 400 });
    }

    const pripraveno = polozkyVykazu(vstup);
    if (!pripraveno.ok) return NextResponse.json({ error: pripraveno.chyba }, { status: 400 });

    const kolize = await najdiKolizi(session.user.id, pripraveno.data);
    if (kolize) return NextResponse.json({ error: hlaskaOKolizi(kolize) }, { status: 409 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { hourlyRate: true },
    });

    const vykaz = await prisma.timesheetEntry.create({
      data: {
        userId: session.user.id,
        ...pripraveno.data,
        hourlyRateSnapshot: user?.hourlyRate ?? DEFAULT_HOURLY_RATE,
      },
    });

    await prisma.navrhVykazu.update({
      where: { id: navrh.id },
      data: { stav: 'ZAPSANO', timesheetEntryId: vykaz.id },
    });

    return NextResponse.json({ ok: true, id: vykaz.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/vykazy-navrhy selhalo:', err);
    return NextResponse.json({ error: 'Nepodařilo se to uložit.' }, { status: 500 });
  }
}
