import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

/**
 * NÁHLED ODESLANÉ ZPRÁVY Z HISTORIE PROJEKTU (zadání 19. 10. 2026: „a tady
 * v historii, když někomu pošle portál zprávu, tak se potřebuju prokliknout
 * ideálně na to, co vidí klient, co přesně na něj šlo a kam se může
 * prokliknout. Pro kontrolu").
 *
 * Vrací HTML uložené u záznamu v historii - přesně to, co odešlo poště.
 * Nic se neskládá znovu: vzor zprávy se dá kdykoliv přepsat a odkaz pro
 * klienta zrušit tlačítkem u projektu, takže poskládaný náhled by ukazoval
 * něco jiného než to, co klient dostal.
 *
 * JEN PRO NÁS. Historie projektu je interní záložka a tohle je její část;
 * ve zprávě jsou navíc odkazy s tokenem pro klienta.
 *
 * ODKAZY SE OTEVÍRAJÍ V NOVÉM PANELU. Náhled běží v rámu (iframe), takže bez
 * `base target` by proklik přepsal jen ten rám - a člověk by nevěděl, kam ho
 * odkaz vlastně pustil. Kontrola odkazů je přitom půlka toho, proč tohle
 * vzniklo.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; udalostId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const udalost = (await prisma.projektUdalost.findUnique({
      where: { id: params.udalostId },
      select: { caflouProjectId: true, zpravaHtml: true },
    })) as { caflouProjectId: string; zpravaHtml: string | null } | null;

    // Záznam musí patřit tomu projektu, ze kterého se na něj kouká.
    if (!udalost || udalost.caflouProjectId !== params.id) {
      return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 });
    }
    if (!udalost.zpravaHtml) {
      return NextResponse.json({ error: 'U tohohle záznamu není uložená zpráva.' }, { status: 404 });
    }

    const html = udalost.zpravaHtml.includes('<base ')
      ? udalost.zpravaHtml
      : udalost.zpravaHtml.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">');

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Náhled nepatří do mezipaměti ani do vyhledávačů.
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (err) {
    console.error('GET /api/projekty/[id]/zprava/[udalostId] selhalo:', err);
    return NextResponse.json({ error: 'Náhled se nepodařilo načíst.' }, { status: 500 });
  }
}
