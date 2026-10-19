import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { sestavNahledZpravy } from '@/lib/notifikaceProjektuServer';

/**
 * NÁHLED ODESLANÉ ZPRÁVY Z HISTORIE PROJEKTU (zadání 19. 10. 2026: „a tady
 * v historii, když někomu pošle portál zprávu, tak se potřebuju prokliknout
 * ideálně na to, co vidí klient, co přesně na něj šlo a kam se může
 * prokliknout. Pro kontrolu").
 *
 * DVĚ PODOBY TÉHOŽ NÁHLEDU:
 *
 *  1. OTISK - HTML uložené u záznamu v historii, přesně to, co odešlo poště.
 *     Ukládá se od 19. 10. 2026.
 *  2. REKONSTRUKCE - u starších záznamů (zadání téhož dne: „potřebuju, ať se
 *     prokliknu i zpětně u těch projektů, co šlo na klienta"). Zpráva se
 *     složí znovu: tentýž vzor, tatáž data projektu, tentýž kód. U drtivé
 *     většiny zpráv to je přesně to, co klient dostal - ale zaručit se za to
 *     nedá, protože vzor i název projektu se mohly mezitím změnit.
 *
 * Rekonstrukce to o sobě říká nahlas pruhem nad zprávou. Tiše ji vydávat za
 * otisk by znamenalo, že se podle ní někdo zařídí jako podle dokladu.
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

/** Pruh nad rekonstruovanou zprávou - ať se nečte jako doklad. */
const PRUH_REKONSTRUKCE = `<div style="margin:0;padding:12px 16px;background:#FFF4D6;border-bottom:2px solid #E0A800;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;line-height:1.5;color:#5C4600;">
<strong>Rekonstrukce, ne otisk.</strong> Tahle zpráva odešla dřív, než si portál začal ukládat, co přesně poslal. Složili jsme ji znovu ze vzoru a z údajů projektu, jak platí dnes — u většiny zpráv to sedí, ale znění vzoru, název projektu nebo odkaz pro klienta se od té doby mohly změnit.
</div>`;

function sBase(html: string): string {
  return html.includes('<base ')
    ? html
    : html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">');
}

function sPruhem(html: string): string {
  return /<body[^>]*>/i.test(html)
    ? html.replace(/<body([^>]*)>/i, `<body$1>${PRUH_REKONSTRUKCE}`)
    : `${PRUH_REKONSTRUKCE}${html}`;
}

function stranka(html: string): NextResponse {
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Náhled nepatří do mezipaměti ani do vyhledávačů.
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

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
      select: { caflouProjectId: true, zpravaHtml: true, predchozi: true },
    })) as {
      caflouProjectId: string;
      zpravaHtml: string | null;
      predchozi: string | null;
    } | null;

    // Záznam musí patřit tomu projektu, ze kterého se na něj kouká.
    if (!udalost || udalost.caflouProjectId !== params.id) {
      return NextResponse.json({ error: 'Záznam nenalezen.' }, { status: 404 });
    }

    // 1) Otisk - přesně to, co odešlo.
    if (udalost.zpravaHtml) return stranka(sBase(udalost.zpravaHtml));

    // 2) Rekonstrukce ze vzoru. Stav je u záznamu notifikace v `predchozi`.
    const stav = (udalost.predchozi ?? '').trim();
    if (!stav) {
      return NextResponse.json({ error: 'U tohohle záznamu není uložená zpráva.' }, { status: 404 });
    }

    const slozena = await sestavNahledZpravy(params.id, stav);
    if (!slozena) {
      return NextResponse.json(
        { error: 'Zprávu se nepodařilo složit — vzor pro tenhle stav už neexistuje.' },
        { status: 404 },
      );
    }

    return stranka(sPruhem(sBase(slozena.html)));
  } catch (err) {
    console.error('GET /api/projekty/[id]/zprava/[udalostId] selhalo:', err);
    return NextResponse.json({ error: 'Náhled se nepodařilo načíst.' }, { status: 500 });
  }
}
