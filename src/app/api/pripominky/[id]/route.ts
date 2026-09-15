import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Odškrtnutí připomínky (zadání 15. 9. 2026: „já bych si to pak jen
 * odškrtával a jim by to mizelo") a smazání vlastní připomínky.
 *
 * Odškrtávat smí jen Žůžo-labůžo - je to jeho seznam úkolů. Autor smí svou
 * připomínku smazat, dokud je otevřená (napsal to omylem, vyřešilo se to).
 */
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const telo = (await req.json().catch(() => ({}))) as { hotovo?: boolean; poznamka?: string };
    const hotovo = telo.hotovo !== false;

    await prisma.pripominkaPortalu.update({
      where: { id: params.id },
      data: hotovo
        ? {
            stav: 'HOTOVA',
            hotovoAt: new Date(),
            hotovoById: session.user.id,
            hotovoJmeno: session.user.name || session.user.email || null,
            poznamka: telo.poznamka?.trim() || null,
          }
        : { stav: 'NOVA', hotovoAt: null, hotovoById: null, hotovoJmeno: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/pripominky/[id] selhalo:', err);
    return NextResponse.json({ error: 'Změnu se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

    const pripominka = await prisma.pripominkaPortalu.findUnique({
      where: { id: params.id },
      select: { userId: true, stav: true },
    });
    if (!pripominka) return NextResponse.json({ error: 'Připomínka nenalezena.' }, { status: 404 });

    const jeAutor = pripominka.userId === session.user.id;
    if (!jeAutor && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    await prisma.pripominkaPortalu.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/pripominky/[id] selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}
