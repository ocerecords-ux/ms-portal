import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { ulozVzorPrezentace } from '@/lib/prezentaceVzor';

/** Uložení vzoru textů nabídkové prezentace (11. 10. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  navrhReseni: z.string().max(20_000),
  podminky: z.string().max(20_000),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const ok = await ulozVzorPrezentace({
    navrhReseni: parsed.data.navrhReseni.trim() || null,
    podminky: parsed.data.podminky.trim() || null,
  });
  if (!ok) return NextResponse.json({ error: 'Uložení se nepovedlo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
