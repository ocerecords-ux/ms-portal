import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { buildUpominkaHtml } from '@/lib/email';
import { dosadDoUpominky, ukazkoveHodnotyUpominky } from '@/lib/upominkyFaktur';

/**
 * NÁHLED ROZEPSANÉ UPOMÍNKY (zadání 25. 9. 2026: „chci je někde editovat,
 * včetně náhledu emailu"). Nic neukládá a nic neodesílá - poskládá HTML
 * z toho, co má člověk zrovna ve formuláři, s ukázkovými hodnotami.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const telo = (await req.json().catch(() => null)) as { predmet?: string; text?: string } | null;
  const hodnoty = ukazkoveHodnotyUpominky();

  const html = buildUpominkaHtml({
    to: 'ukazka@example.com',
    predmet: dosadDoUpominky(String(telo?.predmet ?? ''), hodnoty),
    text: dosadDoUpominky(String(telo?.text ?? ''), hodnoty),
    cisloFaktury: hodnoty.cislo,
    castka: hodnoty.castka,
    splatnost: hodnoty.splatnost,
    poradi: Number(hodnoty.poradi) || 1,
  });

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
