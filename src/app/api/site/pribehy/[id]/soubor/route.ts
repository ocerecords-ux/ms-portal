import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiPribeh, smiPoslatPribeh, smiSchvalovatPribehy } from '@/lib/pribehyServer';
import { klicZAdresyUloziste, podepsanyOdkazNaPrilohu } from '@/lib/storage';

/**
 * VÝDEJ SOUBORU PŘÍBĚHU (zadání 6. 10. 2026).
 *
 * PŘESMĚROVÁNÍ, NE PROUDĚNÍ PŘES PORTÁL. U obrázků do plátna (/api/site/
 * obrazek) se bajty posílají skrz portál schválně - jinak by se plátno
 * „ušpinilo" cizí doménou a nešel by export do PNG. Tady se nic neexportuje
 * a jde i o videa, u kterých by portál musel přeposílat desítky MB a navíc
 * obsluhovat Range požadavky, aby šlo přeskakovat v přehrávači. Podepsaná
 * adresa úložiště to umí sama.
 *
 * `?stahnout=1` pošle soubor jako přílohu - tím si ho schvalovatel uloží do
 * telefonu, odkud ho vyvěsí na Instagram.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const kdo = { id: session.user.id, role: session.user.role };

  const pribeh = await nactiPribeh(params.id);
  if (!pribeh) return NextResponse.json({ error: 'Příběh nenalezen.' }, { status: 404 });

  const smi =
    pribeh.autorId === session.user.id
      ? await smiPoslatPribeh(kdo)
      : await smiSchvalovatPribehy(kdo);
  if (!smi) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  if (pribeh.url.startsWith('data:')) {
    const carka = pribeh.url.indexOf(',');
    const typ = pribeh.url.slice(5, pribeh.url.indexOf(';'));
    const bytes = Buffer.from(pribeh.url.slice(carka + 1), 'base64');
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': typ || pribeh.typSouboru, 'Cache-Control': 'private, max-age=600' },
    });
  }

  const klic = klicZAdresyUloziste(pribeh.url);
  const jakoPrilohu = req.nextUrl.searchParams.get('stahnout') === '1';
  const odkaz = klic
    ? await podepsanyOdkazNaPrilohu(klic, pribeh.nazevSouboru, jakoPrilohu)
    : pribeh.url;
  if (!odkaz) return NextResponse.json({ error: 'Soubor se nepodařilo načíst.' }, { status: 500 });
  return NextResponse.redirect(odkaz);
}
