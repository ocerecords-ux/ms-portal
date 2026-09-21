import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewCalendar } from '@/lib/roles';

/**
 * OTISK KALENDÁŘE (zadání 21. 9. 2026: „ještě bych potřeboval, aby se
 * aktualizoval kalendář sám, když mám otevřený prohlížeč nebo aplikaci, co
 * nejdříve").
 *
 * Otevřený kalendář se sem každých pár vteřin zeptá, jestli se něco změnilo.
 * Odpověď je jeden krátký řetězec - počty a čas poslední změny událostí,
 * frekvencí, nabídek a nepřítomností. Když se liší od minula, kalendář si
 * data načte znovu; jinak se nic dalšího nestahuje.
 *
 * Počet je tam kvůli mazání: smazaná událost čas poslední změny neposune,
 * ale počet ano.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  try {
    const [bloky, sloty, nabidky, nepritomnosti] = await Promise.all([
      prisma.studioBlock.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
      prisma.recordingSlot.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
      prisma.recordingRequest.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
      prisma.nepritomnost.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    ]);
    const cast = (a: { _count: { _all: number }; _max: { updatedAt: Date | null } }) =>
      `${a._count._all}:${a._max.updatedAt?.getTime() ?? 0}`;
    const otisk = [bloky, sloty, nabidky, nepritomnosti].map(cast).join('|');
    return NextResponse.json({ otisk }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/kalendar/zmena selhalo:', err);
    return NextResponse.json({ otisk: null }, { status: 500 });
  }
}
