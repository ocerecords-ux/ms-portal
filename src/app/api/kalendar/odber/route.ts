import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewCalendar } from '@/lib/roles';
import { newAccessToken } from '@/lib/calendarServer';

// Zalozeni a odvolani osobniho ICS odkazu. Rozsah nad ramec vlastnich terminu
// dostane jen ten, kdo smi videt kalendar studii.
const schema = z.object({
  scope: z.enum(['MINE', 'STUDIO', 'ALL']).optional(),
  studioId: z.string().trim().optional(),
  revoke: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  try {
    if (d.revoke) {
      await prisma.calendarFeed.updateMany({
        where: { userId: session.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    const scope = d.scope ?? 'MINE';
    if (scope !== 'MINE' && !canViewCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Na kalendář studií nemáte právo.' }, { status: 403 });
    }

    // Novy odkaz vzdy nahradi stary - stary tim prestane platit.
    await prisma.calendarFeed.updateMany({
      where: { userId: session.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const feed = await prisma.calendarFeed.create({
      data: {
        userId: session.user.id,
        token: newAccessToken(),
        scope,
        studioId: scope === 'STUDIO' ? d.studioId || null : null,
      },
    });

    const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    return NextResponse.json({ url: `${baseUrl}/api/ical/${feed.token}` }, { status: 201 });
  } catch (err) {
    console.error('POST /api/kalendar/odber selhalo:', err);
    return NextResponse.json({ error: 'Odkaz se nepodařilo vytvořit.' }, { status: 500 });
  }
}
