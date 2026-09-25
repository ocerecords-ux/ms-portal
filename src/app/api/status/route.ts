import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nactiStatus } from '@/lib/statusyServer';

/**
 * MŮJ STATUS V CHATU (zadání 25. 9. 2026: „a zbytku pak jen nějakou možnost
 * nastavit si individuální status").
 *
 * Nastavuje se jen SVŮJ - účet se bere ze session, v těle žádné userId není,
 * takže nikdo nenapíše status za kolegu. Status z kalendáře se sem neukládá,
 * ten se skládá při čtení (lib/statusyServer.ts).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  text: z.string().trim().max(80),
  emoji: z.string().trim().max(8).nullable().optional(),
  /** ISO čas, do kdy status platí; null = dokud ho nezruším. */
  doKdy: z.string().trim().min(8).nullable().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  return NextResponse.json({ status: await nactiStatus(session.user.id) });
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const text = parsed.data.text.trim();
    if (!text) {
      // Prázdný text = totéž co zrušit; ať se na to nemusí volat DELETE.
      await prisma.user.update({
        where: { id: session.user.id },
        data: { statusText: null, statusEmoji: null, statusDo: null },
      });
      return NextResponse.json({ status: await nactiStatus(session.user.id) });
    }

    let doKdy: Date | null = null;
    if (parsed.data.doKdy) {
      doKdy = new Date(parsed.data.doKdy);
      if (Number.isNaN(doKdy.getTime())) {
        return NextResponse.json({ error: 'Neplatný čas.' }, { status: 400 });
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { statusText: text, statusEmoji: parsed.data.emoji || null, statusDo: doKdy },
    });

    return NextResponse.json({ status: await nactiStatus(session.user.id) });
  } catch (err) {
    console.error('PUT /api/status selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Status se nepodařilo uložit (${message}).` }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

    await prisma.user.update({
      where: { id: session.user.id },
      data: { statusText: null, statusEmoji: null, statusDo: null },
    });
    // Po zrušení ručního může nastoupit ten z kalendáře - vrátíme, co teď platí.
    return NextResponse.json({ status: await nactiStatus(session.user.id) });
  } catch (err) {
    console.error('DELETE /api/status selhalo:', err);
    return NextResponse.json({ error: 'Status se nepodařilo zrušit.' }, { status: 500 });
  }
}
