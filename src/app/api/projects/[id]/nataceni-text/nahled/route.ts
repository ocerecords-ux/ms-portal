import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { htmlNataceciTextu } from '@/lib/nataceniTextServer';

/**
 * NÁHLED NATÁČECÍHO TEXTU (zadání 26. 9. 2026: „pod tím seznamem výstupů mít
 * ten dokument obrandovaný v náhledu, jako u nabídek a faktur").
 *
 * Vrací rovnou HTML, ne JSON - záložka Výstupy ho ukazuje v rámečku, takže
 * list vypadá stejně jako dokument, který pak vznikne na Disku. Je to TÁŽ
 * cesta jako u vyrábění; kdyby měl náhled vlastní, dřív nebo později by
 * ukazoval něco jiného, než co se uloží.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!isInternalRole(session.user.role as never)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id } = await params;
  const vzorId = req.nextUrl.searchParams.get('vzor');
  const podklad = await htmlNataceciTextu(id, vzorId);

  if (!podklad.ok) {
    // I chyba je HTML - rámeček s náhledem ji rovnou ukáže místo prázdna.
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
        `<body style="font-family:Arial,sans-serif;color:#6b6880;font-size:13px;padding:16px;margin:0">` +
        `${podklad.duvod}</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }

  return new NextResponse(podklad.html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
