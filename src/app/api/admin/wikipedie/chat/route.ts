import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/db';
import type { UdajeOsoby } from '@/lib/wikipedieUdaje';
import { odpovezVeChatu, navrhZOdpovedi } from '@/lib/wikipedieChatServer';

/** Chat nad konceptem článku (zadání 22. 9. 2026). Historie je u článku. */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.object({ zprava: z.string().trim().min(1, 'Napište zprávu.').max(4000) });

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const clanek = await prisma.wikiClanek.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!clanek) return NextResponse.json({ zpravy: [] });
  const zpravy = await prisma.wikiZprava.findMany({
    where: { clanekId: clanek.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  return NextResponse.json({
    zpravy: zpravy.map((z) => ({ id: z.id, role: z.role, text: z.text, kdy: z.createdAt.toISOString() })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const clanek = await prisma.wikiClanek.findUnique({ where: { userId: session.user.id } });
  if (!clanek) return NextResponse.json({ error: 'Nejdřív koncept uložte.' }, { status: 400 });

  const historieRaw = await prisma.wikiZprava.findMany({
    where: { clanekId: clanek.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  const historie = historieRaw.map((z) => ({ role: z.role === 'ja' ? ('ja' as const) : ('bot' as const), text: z.text }));

  const moje = await prisma.wikiZprava.create({
    data: { clanekId: clanek.id, role: 'ja', text: parsed.data.zprava },
  });

  const vysledek = await odpovezVeChatu({
    jmeno: session.user.name || session.user.email || 'uživatel',
    udaje: (clanek.udaje as UdajeOsoby | null) ?? null,
    wikitext: clanek.wikitext,
    historie,
    zprava: parsed.data.zprava,
  });
  if (!vysledek.ok) {
    // Zpráva uživatele zůstane v historii, ať se nemusí psát znovu.
    return NextResponse.json({ error: vysledek.chyba }, { status: 502 });
  }

  const bot = await prisma.wikiZprava.create({
    data: { clanekId: clanek.id, role: 'bot', text: vysledek.text },
  });

  return NextResponse.json({
    ok: true,
    moje: { id: moje.id, role: 'ja', text: moje.text, kdy: moje.createdAt.toISOString() },
    odpoved: { id: bot.id, role: 'bot', text: bot.text, kdy: bot.createdAt.toISOString() },
    navrh: navrhZOdpovedi(vysledek.text),
  });
}
