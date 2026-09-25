import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { pozviKlientaStudia } from '@/lib/pozvankaBooking';

/**
 * REZERVACE STUDIA - SPRÁVA (zadání 25. 9. 2026). Zapnutí rezervací u studia,
 * pozvánky muzikantů a odebrání přístupu.
 *
 * Je to v administraci u studií, protože sem patří: kdo si smí bookovat naši
 * kabinu, je věc studia, ne seznamu uživatelů.
 */
export const dynamic = 'force-dynamic';

const nastaveni = z.object({
  studioId: z.string().trim().min(1),
  zapnuto: z.boolean().optional(),
  minMinut: z.number().int().min(15).max(24 * 60).optional(),
  dniDopredu: z.number().int().min(0).max(1000).optional(),
});

const pozvanka = z.object({
  studioId: z.string().trim().min(1),
  email: z.string().trim().min(3).max(200),
  jmeno: z.string().trim().max(200).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = nastaveni.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  await prisma.studio.update({
    where: { id: d.studioId },
    data: {
      ...(d.zapnuto === undefined ? {} : { bookingZapnuto: d.zapnuto }),
      ...(d.minMinut === undefined ? {} : { bookingMinMinut: d.minMinut }),
      ...(d.dniDopredu === undefined ? {} : { bookingDniDopredu: d.dniDopredu }),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = pozvanka.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Zadejte e-mail.' }, { status: 400 });

  const vysledek = await pozviKlientaStudia(
    parsed.data.email,
    parsed.data.studioId,
    parsed.data.jmeno,
  );
  if (!vysledek.ok) {
    return NextResponse.json(
      { error: vysledek.chyba, userId: vysledek.userId, odkaz: vysledek.odkaz },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, userId: vysledek.userId, email: vysledek.email });
}

/**
 * Odebrání přístupu. Účet se NEMAŽE - jeho rezervace v kalendáři zůstávají
 * a mají zůstat čitelné; jen se odpojí od studia a vypne.
 */
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Chybí uživatel.' }, { status: 400 });

  const ucet = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!ucet || ucet.role !== 'BOOKING') {
    return NextResponse.json({ error: 'Tohle není klient studia.' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { bookingStudioId: null, active: false },
  });
  return NextResponse.json({ ok: true });
}
