import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';

/**
 * OTEVŘENÍ ZKUŠEBNÍHO PULTU (zadání 11. 10. 2026).
 *
 * Vrátí odkaz na naši natáčecí místnost pro tohle natáčení; při prvním
 * zavolání k němu vyrobí náhodný token. Token se pak drží - kdo má odkaz
 * z dřívějška, dostane se do téže místnosti.
 *
 * ZATÍM JEN PRO NÁS. Do pozvánek odkaz nejde (běžný provoz zůstává na Google
 * Meet), takže ho vydáváme jen přihlášené produkci.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; blockId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canManageCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const blok = await prisma.studioBlock
    .findUnique({
      where: { id: params.blockId },
      select: { id: true, caflouProjectId: true, pultToken: true },
    })
    .catch(() => null);

  if (!blok || blok.caflouProjectId !== params.id) {
    return NextResponse.json({ error: 'Natáčení nenalezeno.' }, { status: 404 });
  }

  let token = blok.pultToken;
  if (!token) {
    token = randomBytes(24).toString('base64url');
    const ulozeno = await prisma.studioBlock
      .update({ where: { id: blok.id }, data: { pultToken: token }, select: { pultToken: true } })
      .catch((err) => {
        console.error('Token pultu se nepodařilo uložit:', err);
        return null;
      });
    if (!ulozeno?.pultToken) {
      return NextResponse.json({ error: 'Pult se nepodařilo připravit.' }, { status: 500 });
    }
    token = ulozeno.pultToken;
  }

  return NextResponse.json({ url: `/nataceni/pult/${token}` });
}
