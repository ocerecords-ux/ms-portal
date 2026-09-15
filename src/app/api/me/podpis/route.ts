import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { validSignatureImage } from '@/lib/contractsServer';

/**
 * Vlastní podpis na smlouvy (zadání 15. 9. 2026). Kdo za Mediaspace smlouvy
 * podepisuje, uloží si ho jednou v Mém účtu a od té chvíle odchází každá
 * smlouva k podpisu už s ním.
 *
 * Bez uloženého podpisu se ve smlouvě vypíše jméno psaným písmem - doložka
 * (čas, IP, otisk textu) je v obou případech stejná, takže právně se nic
 * nemění; jde jen o to, jak to vypadá.
 */
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
    if (!isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const telo = (await req.json().catch(() => ({}))) as { imageData?: unknown; smazat?: boolean };

    if (telo.smazat) {
      await prisma.user.update({ where: { id: session.user.id }, data: { podpisSmluv: null } });
      return NextResponse.json({ ok: true, ulozeno: false });
    }

    if (!validSignatureImage(telo.imageData)) {
      return NextResponse.json({ error: 'Chybí podpis — podepište se do rámečku.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { podpisSmluv: telo.imageData as string },
    });
    return NextResponse.json({ ok: true, ulozeno: true });
  } catch (err) {
    console.error('PUT /api/me/podpis selhalo:', err);
    return NextResponse.json({ error: 'Podpis se nepodařilo uložit.' }, { status: 500 });
  }
}
