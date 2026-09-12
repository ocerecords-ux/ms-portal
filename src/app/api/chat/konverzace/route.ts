import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat, loadConversations, loadTeam } from '@/lib/chatServer';

// Seznam konverzaci + zalozeni nove (zadani 8. 9. 2026).
export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('kind', [
  // Kanal k projektu z Caflou - zaklada se az ve chvili, kdy do nej nekdo
  // poprve napise. Kanalu je tim presne tolik, kolik se jich opravdu pouziva.
  z.object({
    kind: z.literal('PROJEKT'),
    caflouProjectId: z.string().trim().min(1),
    name: z.string().trim().min(1).max(120),
  }),
  z.object({ kind: z.literal('SOUKROMA'), userId: z.string().trim().min(1) }),
  z.object({
    kind: z.literal('SKUPINA'),
    name: z.string().trim().min(1, 'Skupina musí mít název.').max(60),
    userIds: z.array(z.string().trim().min(1)).min(1, 'Vyberte aspoň jednoho člověka.').max(30),
  }),
]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    const [konverzace, tym] = await Promise.all([
      loadConversations(session.user.id),
      loadTeam(session.user.id),
    ]);
    return NextResponse.json({ konverzace, tym });
  } catch (err) {
    // Databaze bez tabulek chatu (jeste nedobehl `prisma db push`) nesmi
    // shodit stranku - panel se proste ukaze prazdny.
    //
    // ALE PRAZDNY PANEL NESMI VYPADAT JAKO "nic tu neni" (12. 9. 2026:
    // „zmizely nam z chatu skupiny, ktere jsme tam meli vytvorene").
    // Tichy catch delal z rozbite databaze prazdny seznam a nebylo poznat,
    // ze se neco pokazilo. Adminovi proto duvod rovnou posleme.
    console.error('GET /api/chat/konverzace selhalo:', err);
    const duvod = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      konverzace: [],
      tym: [],
      chyba: session.user.role === 'ADMIN' ? duvod.slice(0, 900) : 'Chat se teď nepodařilo načíst.',
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    if (data.kind === 'PROJEKT') {
      const existing = await prisma.conversation.findUnique({
        where: { caflouProjectId: data.caflouProjectId },
      });
      if (existing) return NextResponse.json({ id: existing.id });
      const created = await prisma.conversation.create({
        data: {
          kind: 'PROJEKT',
          name: data.name,
          caflouProjectId: data.caflouProjectId,
          createdById: me,
          members: { create: { userId: me } },
        },
      });
      return NextResponse.json({ id: created.id }, { status: 201 });
    }

    if (data.kind === 'SOUKROMA') {
      if (data.userId === me) {
        return NextResponse.json({ error: 'Sám se sebou si psát nemusíte.' }, { status: 400 });
      }
      // Druhy clovek musi byt z tymu - jinak by sla zalozit konverzace s
      // klientem nebo hercem, kteri chat vubec nemaji.
      const druhy = await prisma.user.findFirst({
        where: { id: data.userId, active: true, role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
        select: { id: true },
      });
      if (!druhy) return NextResponse.json({ error: 'Takového člena týmu nemáme.' }, { status: 400 });

      // Uz spolu mluvi? Hledame konverzaci, kde jsou oba - jinak by kazde
      // kliknuti zalozilo dalsi vlakno s tou samou osobou.
      const existing = await prisma.conversation.findFirst({
        where: {
          kind: 'SOUKROMA',
          AND: [{ members: { some: { userId: me } } }, { members: { some: { userId: druhy.id } } }],
        },
      });
      if (existing) return NextResponse.json({ id: existing.id });

      const created = await prisma.conversation.create({
        data: {
          kind: 'SOUKROMA',
          createdById: me,
          members: { create: [{ userId: me }, { userId: druhy.id }] },
        },
      });
      return NextResponse.json({ id: created.id }, { status: 201 });
    }

    const clenove = await prisma.user.findMany({
      where: { id: { in: data.userIds }, active: true, role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
      select: { id: true },
    });
    const ids = Array.from(new Set([me, ...clenove.map((u) => u.id)]));
    const created = await prisma.conversation.create({
      data: {
        kind: 'SKUPINA',
        name: data.name,
        createdById: me,
        members: { create: ids.map((id) => ({ userId: id })) },
      },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/chat/konverzace selhalo:', err);
    return NextResponse.json({ error: 'Založení se nezdařilo.' }, { status: 500 });
  }
}
