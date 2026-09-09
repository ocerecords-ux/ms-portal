import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { loadOccupancy } from '@/lib/calendarServer';

/**
 * Blokace založená přímo z kalendáře dvojklikem (zprava uzivatele 9. 9. 2026:
 * "do kalendáře by mělo jít přidávat dvojklikem").
 *
 * Na rozdíl od /api/admin/studia/blokace sem smí i Produkce — je to její
 * denní práce, ne administrace.
 */
const schema = z.object({
  studioId: z.string().trim().min(1),
  start: z.string().trim().min(8),
  end: z.string().trim().min(8),
  kind: z.enum(['HOLIDAY', 'VACATION', 'MAINTENANCE', 'INTERNAL', 'OTHER']).optional(),
  title: z.string().trim().min(1, 'Vyplňte, čeho se blokace týká.').max(160),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const start = new Date(d.start);
    const end = new Date(d.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Konec blokace musí být po začátku.' }, { status: 400 });
    }

    // Pres uz domluvene nataceni se blokace nedava.
    const obsazeno = await loadOccupancy([d.studioId], start, end);
    if (obsazeno.slots.length > 0) {
      return NextResponse.json(
        { error: `V tomhle čase je natáčení: ${obsazeno.slots.map((s) => s.label).join(', ')}.` },
        { status: 409 },
      );
    }
    if (obsazeno.blocks.length > 0) {
      return NextResponse.json({ error: 'V tomhle čase už blokace je.' }, { status: 409 });
    }

    const block = await prisma.studioBlock.create({
      data: {
        studioId: d.studioId,
        start,
        end,
        kind: d.kind ?? 'INTERNAL',
        title: d.title,
        note: d.note || null,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(block, { status: 201 });
  } catch (err) {
    console.error('POST /api/kalendar/blokace selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Chybí blokace.' }, { status: 400 });

    await prisma.studioBlock.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/kalendar/blokace selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}
