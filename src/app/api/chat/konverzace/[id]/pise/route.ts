import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat, userLabel } from '@/lib/chatServer';

/**
 * Kdo právě píše (zadání 12. 9. 2026: „aby bylo vidět, když s někým chatuješ,
 * že na té druhé straně ten člověk píše").
 *
 * JAK TO CHODÍ: kdo píše, ohlásí se sem každých pár vteřin (POST). Kdo se
 * dívá, se sem každé tři vteřiny zeptá (GET). Za „píše" se považuje ohlášení
 * mladší než PLATNOST_MS — když člověk přestane psát nebo zavře okno, jeho
 * řádek prostě zestárne a zmizí sám. Nic se nemaže a nic se nemusí hlídat.
 *
 * Schválně to nejde přes seznam konverzací, který se načítá po dvanácti
 * vteřinách: to je na psaní věčnost. Tenhle dotaz je za to malý — vrací jen
 * jména a chodí, jen když je konverzace otevřená a okno vidět.
 */
export const dynamic = 'force-dynamic';

/** Jak dlouho platí jedno ohlášení. Prohlížeč se hlásí zhruba po třech vteřinách. */
const PLATNOST_MS = 7000;

async function ostatniPisici(conversationId: string, me: string) {
  const od = new Date(Date.now() - PLATNOST_MS);
  const radky = await prisma.chatPise.findMany({
    where: { conversationId, updatedAt: { gte: od }, userId: { not: me } },
    select: { userId: true },
    take: 10,
  });
  if (radky.length === 0) return [];

  const lide = await prisma.user.findMany({
    where: { id: { in: radky.map((r) => r.userId) } },
    select: { name: true, email: true },
  });
  return lide.map(userLabel);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ pisou: [] });
  }
  return NextResponse.json({ pisou: await ostatniPisici(params.id, session.user.id) });
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ pisou: [] });
  }
  const me = session.user.id;

  // Ohlaseni nesmi shodit psani, kdyz se nepovede - je to jen ozdoba.
  await prisma.chatPise
    .upsert({
      where: { conversationId_userId: { conversationId: params.id, userId: me } },
      // `updatedAt` se prepisuje samo, ale Prisma chce u update aspon jedno
      // pole - proto se prepisuje sam na sebe.
      update: { userId: me },
      create: { conversationId: params.id, userId: me },
    })
    .catch(() => undefined);

  return NextResponse.json({ pisou: await ostatniPisici(params.id, me) });
}
