import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Uprava studia vcetne pracovni doby. Studio se nemaze - vyradi se, protoze
// na nem visi rezervace a historie.
const hodinySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  byArrangement: z.boolean(),
});

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  shortName: z.string().trim().min(1).max(40).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  timezone: z.string().trim().max(60).optional(),
  active: z.boolean().optional(),
  hours: z.array(hodinySchema).max(7).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    if (d.hours?.some((h) => h.endMinutes <= h.startMinutes)) {
      return NextResponse.json({ error: 'Konec pracovní doby musí být po začátku.' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.shortName !== undefined) data.shortName = d.shortName;
    if (d.location !== undefined) data.location = d.location || null;
    if (d.color !== undefined) data.color = d.color;
    if (d.timezone !== undefined) data.timezone = d.timezone;
    if (d.active !== undefined) data.active = d.active;

    await prisma.$transaction(async (tx) => {
      await tx.studio.update({ where: { id: params.id }, data });
      if (d.hours) {
        for (const h of d.hours) {
          await tx.studioHours.upsert({
            where: { studioId_weekday: { studioId: params.id, weekday: h.weekday } },
            update: { startMinutes: h.startMinutes, endMinutes: h.endMinutes, byArrangement: h.byArrangement },
            create: {
              studioId: params.id,
              weekday: h.weekday,
              startMinutes: h.startMinutes,
              endMinutes: h.endMinutes,
              byArrangement: h.byArrangement,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/studia/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
