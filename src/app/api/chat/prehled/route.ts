import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat, userLabel } from '@/lib/chatServer';
import { jeZminen } from '@/lib/chatUpozorneniServer';

/**
 * HISTORIE UPOZORNĚNÍ V CHATU (zadání 22. 10. 2026: „stává se, že mám třeba
 * od někoho více zpráv a otevřu to na mobilu a nevím pak, kde jsem označený
 * apod. abych měl prostě přehled o všech zprávách"; navazuje na připomínku
 * Petra Drátvy 21. 10. 2026: „história notifikácii v mobilnom chate").
 *
 * PROČ SE NEČTE Z UPOZORNĚNÍ: upozornění z chatu se nikam neukládají —
 * zazvoní na telefonu a tím to končí (do zvonku v liště schválně nechodí,
 * viz lib/notifications.ts). Historie se proto skládá ze ZPRÁV SAMOTNÝCH:
 * všechno, co mi od někoho přišlo, se dá vypsat zpětně a nic se k tomu
 * nemusí zapisovat navíc — takže to funguje i pro to, co přišlo dřív, než
 * tahle obrazovka vznikla.
 *
 * FILTRY: `vse` (co mi přišlo), `zminky` (kde jsem jmenovitě označený) a
 * `neprectene` (co jsem ještě neotevřel). Vlastní zprávy se nikdy nepočítají.
 */
export const dynamic = 'force-dynamic';

const NEJVIC = 60;
/** Jak daleko do minulosti. Starší se dohledá hledáním ve zprávách. */
const DNU_ZPET = 30;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const ja = session.user.id;
  const filtr = (req.nextUrl.searchParams.get('filtr') ?? 'vse').trim();

  try {
    const mojeUdaje = (await prisma.user.findUnique({
      where: { id: ja },
      select: { name: true, email: true },
    })) as { name: string | null; email: string } | null;

    const konverzace = (await prisma.conversation.findMany({
      where: {
        uzavrenoAt: null,
        OR: [{ kind: 'PROJEKT' }, { vsichni: true }, { members: { some: { userId: ja } } }],
      },
      select: {
        id: true,
        kind: true,
        name: true,
        members: {
          select: { userId: true, lastReadAt: true, user: { select: { name: true, email: true } } },
        },
      },
    })) as {
      id: string;
      kind: string;
      name: string | null;
      members: { userId: string; lastReadAt: Date; user: { name: string | null; email: string } }[];
    }[];

    if (!mojeUdaje || konverzace.length === 0) return NextResponse.json({ zpravy: [] });

    // Název rozhovoru a moje „přečteno do" - obojí po ruce podle id rozhovoru.
    const nazvy = new Map<string, string>();
    const precteno = new Map<string, Date | null>();
    for (const k of konverzace) {
      const druhy = k.members.find((m) => m.userId !== ja);
      nazvy.set(
        k.id,
        k.kind === 'SOUKROMA' ? (druhy ? userLabel(druhy.user) : 'Soukromá zpráva') : (k.name ?? 'Bez názvu'),
      );
      precteno.set(k.id, k.members.find((m) => m.userId === ja)?.lastReadAt ?? null);
    }

    const od = new Date(Date.now() - DNU_ZPET * 24 * 60 * 60 * 1000);
    const zpravy = (await prisma.message.findMany({
      where: {
        conversationId: { in: konverzace.map((k) => k.id) },
        userId: { not: ja },
        createdAt: { gte: od },
      },
      orderBy: { createdAt: 'desc' },
      // Na zmínky a nepřečtené se filtruje až tady v kódu, proto se bere víc
      // řádků, než se nakonec vypíše.
      take: NEJVIC * 4,
      select: {
        id: true,
        conversationId: true,
        parentId: true,
        body: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    })) as {
      id: string;
      conversationId: string;
      parentId: string | null;
      body: string;
      createdAt: Date;
      user: { name: string | null; email: string } | null;
    }[];

    const vypis = zpravy
      .map((z) => {
        const kdyPrecteno = precteno.get(z.conversationId) ?? null;
        return {
          id: z.id,
          konverzaceId: z.conversationId,
          konverzace: nazvy.get(z.conversationId) ?? '',
          vlaknoId: z.parentId,
          autor: z.user ? userLabel(z.user) : null,
          text: zkrat(z.body),
          kdy: z.createdAt.toISOString(),
          zminka: jeZminen(z.body, mojeUdaje.name, mojeUdaje.email),
          neprectene: kdyPrecteno ? z.createdAt > kdyPrecteno : true,
        };
      })
      .filter((z) => (filtr === 'zminky' ? z.zminka : filtr === 'neprectene' ? z.neprectene : true))
      .slice(0, NEJVIC);

    return NextResponse.json({ zpravy: vypis });
  } catch (err) {
    console.error('Prehled upozorneni chatu selhal:', err);
    return NextResponse.json({ zpravy: [] });
  }
}

/** Jeden řádek ze zprávy - v přehledu jde o to ji poznat, ne přečíst celou. */
function zkrat(text: string): string {
  const jedenRadek = text.replace(/\s+/g, ' ').trim();
  if (!jedenRadek) return '';
  return jedenRadek.length <= 140 ? jedenRadek : `${jedenRadek.slice(0, 137)}…`;
}
