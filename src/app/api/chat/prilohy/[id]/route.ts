import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';
import { podepsanyOdkazNaPrilohu } from '@/lib/storage';

/**
 * Výdej přílohy z chatu (zadání 9. 9. 2026).
 *
 * Přílohy nemají trvalou veřejnou adresu - v chatu můžou být klientské
 * materiály, takže by stačilo poslat odkaz dál a viděl by to kdokoliv. Místo
 * toho se pokaždé ověří, že uživatel do té konverzace vůbec smí, a teprve pak
 * se vydá krátkodobý podepsaný odkaz do úložiště.
 *
 * Pravidlo přístupu je stejné jako u čtení zpráv: kanál k projektu je pro
 * celý tým, soukromá a skupinová konverzace jen pro členy.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const priloha = await prisma.messageAttachment.findUnique({
      where: { id: params.id },
      select: {
        key: true,
        name: true,
        message: {
          select: {
            conversation: { select: { kind: true, members: { select: { userId: true } } } },
          },
        },
      },
    });
    // Chybějící i nepřístupná příloha odpovídají stejně, ať z odpovědi nejde
    // vyčíst, co v portálu existuje.
    if (
      !priloha ||
      (priloha.message.conversation.kind !== 'PROJEKT' &&
        !priloha.message.conversation.members.some((m) => m.userId === me))
    ) {
      return NextResponse.json({ error: 'Příloha nenalezena.' }, { status: 404 });
    }

    // ?stahnout=1 posle soubor rovnou do stazenych, jinak se otevre.
    const stahnout = req.nextUrl.searchParams.get('stahnout') === '1';
    const odkaz = await podepsanyOdkazNaPrilohu(priloha.key, priloha.name, stahnout);
    if (!odkaz) {
      return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });
    }

    // Přesměrování, ne proxy: soubor tak nejde přes funkci na Vercelu a jeho
    // velikost nikde nenaráží na strop.
    return NextResponse.redirect(odkaz, { status: 307 });
  } catch (err) {
    console.error('GET /api/chat/prilohy/[id] selhalo:', err);
    return NextResponse.json({ error: 'Přílohu se nepodařilo načíst.' }, { status: 500 });
  }
}
