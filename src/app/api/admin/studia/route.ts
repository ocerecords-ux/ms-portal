import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Zalozeni studia. Pracovni doba a presety se doplni rovnou, at nove studio
// neni v kalendari mrtve.
const schema = z.object({
  name: z.string().trim().min(1, 'Vyplňte název studia.').max(120),
  shortName: z.string().trim().min(1).max(40),
  location: z.string().trim().max(120).optional(),
  color: z.string().trim().max(20).optional(),
  timezone: z.string().trim().max(60).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const exists = await prisma.studio.findUnique({ where: { name: d.name }, select: { id: true } });
    if (exists) return NextResponse.json({ error: 'Studio s tímhle názvem už existuje.' }, { status: 409 });

    const last = await prisma.studio.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });

    const studio = await prisma.studio.create({
      data: {
        name: d.name,
        shortName: d.shortName,
        location: d.location || null,
        color: d.color || '#7B55FF',
        timezone: d.timezone || 'Europe/Prague',
        sortOrder: (last?.sortOrder ?? 0) + 10,
        hours: {
          create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
            weekday,
            startMinutes: 8 * 60,
            endMinutes: 20 * 60,
            byArrangement: weekday === 0 || weekday === 6,
          })),
        },
        presets: {
          create: [
            { label: 'Dopolední', startMinutes: 9 * 60, endMinutes: 13 * 60, sortOrder: 10 },
            { label: 'Odpolední', startMinutes: 13 * 60, endMinutes: 17 * 60, sortOrder: 20 },
          ],
        },
      },
    });

    return NextResponse.json(studio, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/studia selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Založení se nezdařilo (${message}).` }, { status: 500 });
  }
}
