import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat, userLabel } from '@/lib/chatServer';

/**
 * HLEDÁNÍ VE ZPRÁVÁCH (připomínka Petra Drátvy 21. 10. 2026: „v chate pridať
 * možnosť fulltext vyhľadávania v správach").
 *
 * Do teď se hledalo jen v NÁZVECH rozhovorů (19. 10. 2026, připomínka Helči).
 * To stačí, když člověk ví, s kým mluvil - ne když si pamatuje jen větu.
 *
 * KDE SE HLEDÁ: jen tam, kam ten člověk vidí - kanály projektů (ty jsou pro
 * celý tým), skupina „všichni" a rozhovory, kde je členem. Je to týž výčet
 * jako v seznamu rozhovorů; kdyby se rozešly, hledání by ukázalo zprávu
 * z rozhovoru, který se jinak neotevře.
 *
 * Výsledků je nejvýš třicet - hledání má
 * dovést ke zprávě, ne nahradit rozhovor.
 */
export const dynamic = 'force-dynamic';

const NEJVIC = 30;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const dotaz = (req.nextUrl.searchParams.get('q') ?? '').trim();
  // Dvě písmena hledají půlku chatu - od tří je výsledek k něčemu.
  if (dotaz.length < 3) return NextResponse.json({ zpravy: [] });

  try {
    const konverzace = (await prisma.conversation.findMany({
      where: {
        uzavrenoAt: null,
        OR: [{ kind: 'PROJEKT' }, { vsichni: true }, { members: { some: { userId: session.user.id } } }],
      },
      select: { id: true, kind: true, name: true, members: { select: { user: { select: { name: true, email: true } }, userId: true } } },
    })) as {
      id: string;
      kind: string;
      name: string | null;
      members: { userId: string; user: { name: string | null; email: string } }[];
    }[];

    if (konverzace.length === 0) return NextResponse.json({ zpravy: [] });

    const nazvy = new Map(
      konverzace.map((k) => {
        // U soukromého rozhovoru je názvem ten druhý člověk, stejně jako
        // v seznamu - „Soukromá zpráva" by v hledání nikomu nepomohla.
        const druhy = k.members.find((m) => m.userId !== session.user.id);
        const label =
          k.kind === 'SOUKROMA' ? (druhy ? userLabel(druhy.user) : 'Soukromá zpráva') : (k.name ?? 'Bez názvu');
        return [k.id, label] as [string, string];
      }),
    );

    const zpravy = (await prisma.message.findMany({
      where: {
        conversationId: { in: konverzace.map((k) => k.id) },
        body: { contains: dotaz, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: NEJVIC,
      select: {
        id: true,
        conversationId: true,
        parentId: true,
        body: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    })) as {
      id: string;
      conversationId: string;
      parentId: string | null;
      body: string;
      createdAt: Date;
      userId: string;
      user: { name: string | null; email: string } | null;
    }[];

    return NextResponse.json({
      zpravy: zpravy.map((z) => ({
        id: z.id,
        konverzaceId: z.conversationId,
        konverzace: nazvy.get(z.conversationId) ?? '',
        vlaknoId: z.parentId,
        autor: z.userId === session.user.id ? null : z.user ? userLabel(z.user) : null,
        // Dlouhou zprávu zkrátíme kolem nalezeného místa - v seznamu výsledků
        // jde o to, poznat tu pravou, ne číst ji celou.
        text: vyrizni(z.body, dotaz),
        kdy: z.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Hledani ve zpravach selhalo:', err);
    return NextResponse.json({ zpravy: [] });
  }
}

/** Kousek zprávy kolem hledaného slova, ať je v seznamu poznat kontext. */
function vyrizni(text: string, dotaz: string): string {
  const jedenRadek = text.replace(/\s+/g, ' ').trim();
  if (jedenRadek.length <= 120) return jedenRadek;
  const kde = jedenRadek.toLowerCase().indexOf(dotaz.toLowerCase());
  if (kde < 0) return `${jedenRadek.slice(0, 117)}…`;
  const od = Math.max(0, kde - 40);
  const do_ = Math.min(jedenRadek.length, kde + dotaz.length + 60);
  return `${od > 0 ? '…' : ''}${jedenRadek.slice(od, do_)}${do_ < jedenRadek.length ? '…' : ''}`;
}
