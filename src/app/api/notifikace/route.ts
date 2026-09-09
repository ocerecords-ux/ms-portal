import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { loadNotifications } from '@/lib/notifications';

// Zvonek v horni liste. Cte a oznacuje precteno - vzdy jen VLASTNI
// notifikace, userId se bere ze session, nikdy z pozadavku.
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const items = await loadNotifications(session.user.id);
  return NextResponse.json({
    notifikace: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const telo = await req.json().catch(() => ({}));
  const ids: unknown = telo?.ids;

  try {
    if (Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, id: { in: ids.filter((x): x is string => typeof x === 'string') } },
        data: { readAt: new Date() },
      });
    } else {
      // Bez seznamu se oznaci precteno vsechno.
      await prisma.notification.updateMany({
        where: { userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/notifikace selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
