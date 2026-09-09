import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { findQuickAction } from '@/lib/quickActions';

// Ulozeni rychlych voleb v levem panelu (zadani 9. 9. 2026). Panel patri
// KONKRETNIMU uzivateli - stejne jako horni lista, uprava se nikomu jinemu
// nepromitne. Uzivatel se nastavuje VYHRADNE ze session.
const schema = z.object({
  keys: z.array(z.string().trim().min(1)).max(20),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    // Do databaze jdou jen zname akce, na ktere ma uzivatel pravo - jinak by
    // si slo pres API pridat zkratku na stranku, kam ho stejne nepustime.
    const role = session.user.role;
    const keys: string[] = [];
    for (const key of parsed.data.keys) {
      const akce = findQuickAction(key);
      if (akce && akce.roles.includes(role) && !keys.includes(key)) keys.push(key);
    }

    const userId = session.user.id;
    await prisma.$transaction([
      prisma.userQuickAction.deleteMany({ where: { userId } }),
      prisma.userQuickAction.createMany({
        data: keys.map((actionKey, index) => ({ userId, actionKey, sortOrder: index })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/quick-actions selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
