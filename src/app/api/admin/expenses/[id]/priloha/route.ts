import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { klicZAdresyUloziste, podepsanyOdkazNaPrilohu } from '@/lib/storage';

/**
 * VÝDEJ PŘÍLOHY DOKLADU (oprava 15. 9. 2026: „ten výdaj s QR nejde otevřít" -
 * odkaz končil hláškou InvalidArgumentAuthorization).
 *
 * Adresa, pod kterou se soubor uloží do R2, je ROZHRANÍ ÚLOŽIŠTĚ, ne veřejný
 * odkaz - kdo na ni přijde bez podpisu, dostane od úložiště chybu. Dřív se do
 * stránky dávala rovnou, takže přílohy nahrané do R2 nešly otevřít vůbec.
 * Tady se pokaždé ověří, že se dívá admin, a teprve pak se vydá krátkodobý
 * podepsaný odkaz - stejně jako u příloh v chatu.
 *
 * Starší doklady mají přílohu uloženou jako data URL rovnou v databázi
 * (dokud nebylo nastavené úložiště); ty se vydají přímo.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    // Dalsi priloha (21. 9. 2026) se vybira parametrem ?priloha=<id>,
    // bez nej jde o hlavni prilohu dokladu.
    const dalsiId = req.nextUrl.searchParams.get('priloha');
    const expense = dalsiId
      ? await prisma.prilohaVydaje
          .findFirst({ where: { id: dalsiId, expenseId: params.id }, select: { url: true, nazev: true } })
          .then((p) => (p ? { attachmentUrl: p.url, attachmentName: p.nazev } : null))
      : await prisma.expense.findUnique({
          where: { id: params.id },
          select: { attachmentUrl: true, attachmentName: true },
        });
    if (!expense?.attachmentUrl) {
      return NextResponse.json({ error: 'Doklad přílohu nemá.' }, { status: 404 });
    }

    const nazev = expense.attachmentName || 'priloha';
    const stahnout = req.nextUrl.searchParams.get('stahnout') === '1';

    if (expense.attachmentUrl.startsWith('data:')) {
      const [hlavicka, base64] = expense.attachmentUrl.split(',', 2);
      const typ = hlavicka.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
      const obsah = Buffer.from(base64 ?? '', 'base64');
      return new NextResponse(obsah, {
        headers: {
          'Content-Type': typ,
          'Content-Disposition': `${stahnout ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(nazev)}`,
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    const klic = klicZAdresyUloziste(expense.attachmentUrl);
    const odkaz = klic ? await podepsanyOdkazNaPrilohu(klic, nazev, stahnout) : null;
    // Když se podepsat nedá (jiné úložiště, vypnuté S3), zkusíme adresu tak,
    // jak je - u veřejného úložiště to pořád funguje.
    return NextResponse.redirect(odkaz ?? expense.attachmentUrl, { status: 307 });
  } catch (err) {
    console.error('GET /api/admin/expenses/[id]/priloha selhalo:', err);
    return NextResponse.json({ error: 'Přílohu se nepodařilo vydat.' }, { status: 500 });
  }
}
