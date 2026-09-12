import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat } from '@/lib/chatServer';

/**
 * Správa skupiny v chatu (zadání 11. 9. 2026: „potřebuju založit na chatu
 * skupiny, ve kterých budeme jen my z vedení, aby do skupiny vedení
 * neviděli zvukaři").
 *
 * Skupina byla od začátku vidět jen svým členům — tohle přidává to, co
 * chybělo: přejmenovat ji, někoho přidat nebo odebrat a odejít z ní. Bez
 * toho by se skupina vedení musela při každé změně v týmu zakládat znovu
 * a historie by zůstala v té staré.
 *
 * KDO SMÍ: jen člen té skupiny, a ověřuje se to při každém požadavku.
 * Kanál k projektu (PROJEKT) ani dotaz klienta (DOTAZ) se takhle měnit
 * nedají — ty nemají členy, které by šlo vybírat.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1, 'Skupina musí mít název.').max(60).optional(),
  /** Úplný seznam členů včetně mě — co v něm není, se odebere. */
  userIds: z.array(z.string().trim().min(1)).max(30).optional(),
});

async function mojeSkupina(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, kind: true, vsichni: true, members: { select: { userId: true } } },
  });
  if (!conversation || conversation.kind !== 'SKUPINA') return null;
  if (!conversation.members.some((m) => m.userId === userId)) return null;
  return conversation;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const skupina = await mojeSkupina(params.id, me);
    if (!skupina) return NextResponse.json({ error: 'Skupina nenalezena.' }, { status: 404 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { name, userIds } = parsed.data;

    if (name) {
      await prisma.conversation.update({ where: { id: skupina.id }, data: { name } });
    }

    if (userIds) {
      // SKUPINA PRO CELY TYM SE NEOSAZUJE RUCNE (zadani 12. 9. 2026: „kde
      // budou vzdy pridani vsichni"). Kdyby z ni sel nekoho vyhodit, pri
      // pristim otevreni chatu by se stejne vratil - lepsi to rict rovnou.
      if (skupina.vsichni) {
        return NextResponse.json(
          { error: 'Do téhle skupiny patří celý tým, členy v ní měnit nejde.' },
          { status: 400 },
        );
      }
      // Sam sebe ze skupiny takhle nevyhodim - na odchod je DELETE. Jinak by
      // staci preklik a clovek by se ze skupiny vyradil bez varovani.
      const povoleni = await prisma.user.findMany({
        where: { id: { in: userIds }, active: true, role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
        select: { id: true },
      });
      const cilove = Array.from(new Set([me, ...povoleni.map((u) => u.id)]));
      const stavajici = skupina.members.map((m) => m.userId);

      const pridat = cilove.filter((id) => !stavajici.includes(id));
      const odebrat = stavajici.filter((id) => !cilove.includes(id));

      if (odebrat.length > 0) {
        await prisma.conversationMember.deleteMany({
          where: { conversationId: skupina.id, userId: { in: odebrat } },
        });
      }
      if (pridat.length > 0) {
        // Novy clen vidi celou historii skupiny - jinak by mu prvni otevreni
        // ukazalo prazdno a nevedel by proc. Je to vedome: kdo se do skupiny
        // dostane, dostane se i k tomu, co se v ni psalo drive.
        await prisma.conversationMember.createMany({
          data: pridat.map((userId) => ({ conversationId: skupina.id, userId })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/chat/konverzace/[id] selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}

/**
 * Odchod ze skupiny. Když odejde poslední člen, skupina i se zprávami zmizí —
 * konverzace, do které se nikdo nedostane, by jinak zůstala viset navždy.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const skupina = await mojeSkupina(params.id, me);
    if (!skupina) return NextResponse.json({ error: 'Skupina nenalezena.' }, { status: 404 });

    if (skupina.vsichni) {
      return NextResponse.json(
        { error: 'Z téhle skupiny odejít nejde — je v ní celý tým. Můžete si ji ztlumit.' },
        { status: 400 },
      );
    }

    if (skupina.members.length <= 1) {
      await prisma.conversation.delete({ where: { id: skupina.id } });
      return NextResponse.json({ ok: true, smazano: true });
    }

    await prisma.conversationMember.deleteMany({
      where: { conversationId: skupina.id, userId: me },
    });
    return NextResponse.json({ ok: true, smazano: false });
  } catch (err) {
    console.error('DELETE /api/chat/konverzace/[id] selhalo:', err);
    return NextResponse.json({ error: 'Odchod se nezdařil.' }, { status: 500 });
  }
}
