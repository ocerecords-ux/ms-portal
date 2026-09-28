import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { renderCenikPdf } from '@/lib/cenikPdf';
import { cenikFileName } from '@/lib/studioCenik';
import { smiSpravovatCenik, zajistiCenik } from '@/lib/studioCenikServer';

/**
 * Ceník studia ke stažení v PDF (zadání 28. 9. 2026).
 *
 * `?nahled=1` vrátí PDF k zobrazení v okně (inline), bez něj se stahuje.
 * Náhled používá editor, aby bylo vidět, jak dokument opravdu vypadá - kreslí
 * ho stejná funkce jako to, co odejde klientovi, takže se náhled a skutečnost
 * nemají jak rozejít.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const studioId = req.nextUrl.searchParams.get('studio')?.trim();
  if (!studioId) return NextResponse.json({ error: 'Chybí studio.' }, { status: 400 });
  if (!(await smiSpravovatCenik(session.user.id, session.user.role as never, studioId))) {
    return NextResponse.json({ error: 'Na ceník tohohle studia nemáte právo.' }, { status: 403 });
  }

  try {
    const cenik = await zajistiCenik(studioId);
    const pdf = renderCenikPdf(cenik);
    const nahled = req.nextUrl.searchParams.get('nahled') === '1';
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${nahled ? 'inline' : 'attachment'}; filename="${cenikFileName(cenik.nadpis)}"`,
        // Náhled se má po uložení změnit - kdyby se cachoval, editor by
        // ukazoval starou verzi a nikdo by nepoznal proč.
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('GET /api/studio/cenik/pdf selhalo:', err);
    return NextResponse.json({ error: 'PDF se nepodařilo vyrobit.' }, { status: 500 });
  }
}
