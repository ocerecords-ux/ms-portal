import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewCalendar } from '@/lib/roles';
import { newAccessToken } from '@/lib/calendarServer';

/**
 * ODBĚRY KALENDÁŘE (zadání 8. 9. 2026, přepracováno 20. 9. 2026).
 *
 * Každý může mít víc odkazů - třeba celý kalendář v Google a jen Brno I
 * v telefonu. Pro stejný rozsah se vrací STÁLE TENTÝŽ odkaz, takže když
 * na něj člověk klikne podruhé, nevyrobí si nový a starý mu nepřestane
 * fungovat. Nový odkaz vznikne jen po zneplatnění starého.
 */
const schema = z.object({
  scope: z.enum(['MINE', 'STUDIO', 'ALL']).optional(),
  studioId: z.string().trim().optional(),
  /** Zneplatnit jeden odkaz. */
  revokeId: z.string().trim().optional(),
  /** Zneplatnit všechny moje odkazy (starší chování). */
  revoke: z.boolean().optional(),
});

function adresa(token: string): string {
  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  return `${baseUrl}/api/ical/${token}`;
}

/** Moje platné odkazy. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const feeds = await prisma.calendarFeed.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, token: true, scope: true, studioId: true, lastReadAt: true },
  });
  return NextResponse.json({
    odbery: feeds.map((f) => ({
      id: f.id,
      scope: f.scope,
      studioId: f.studioId,
      url: adresa(f.token),
      // Kdy si ho kalendar naposled stahl - poznat, ze odber opravdu bezi.
      naposledy: f.lastReadAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  try {
    if (d.revoke || d.revokeId) {
      await prisma.calendarFeed.updateMany({
        where: { userId: session.user.id, revokedAt: null, ...(d.revokeId ? { id: d.revokeId } : {}) },
        data: { revokedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    const scope = d.scope ?? 'MINE';
    if (scope !== 'MINE' && !canViewCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Na kalendář studií nemáte právo.' }, { status: 403 });
    }
    const studioId = scope === 'STUDIO' ? d.studioId || null : null;
    if (scope === 'STUDIO' && !studioId) {
      return NextResponse.json({ error: 'Vyberte studio.' }, { status: 400 });
    }

    const uz = await prisma.calendarFeed.findFirst({
      where: { userId: session.user.id, revokedAt: null, scope, studioId },
      select: { token: true, id: true },
    });
    if (uz) return NextResponse.json({ id: uz.id, url: adresa(uz.token) });

    const feed = await prisma.calendarFeed.create({
      data: { userId: session.user.id, token: newAccessToken(), scope, studioId },
    });
    return NextResponse.json({ id: feed.id, url: adresa(feed.token) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/kalendar/odber selhalo:', err);
    return NextResponse.json({ error: 'Odkaz se nepodařilo vytvořit.' }, { status: 500 });
  }
}
