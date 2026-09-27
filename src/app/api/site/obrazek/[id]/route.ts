import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { klicZAdresyUloziste, podepsanyOdkazNaPrilohu } from '@/lib/storage';
import { smiSite } from '@/lib/socialniServer';

/**
 * VÝDEJ OBRÁZKU DO PLÁTNA (zadání 27. 9. 2026).
 *
 * Bajty se posílají ODSUD, ne přesměrováním do úložiště. Dva důvody: adresa
 * v úložišti je podepsaná a propadá (v uloženém plátně by za pár hodin byl
 * mrtvý odkaz), a hlavně - obrázek z cizí domény „ušpiní" plátno a prohlížeč
 * pak odmítne export do PNG. Takhle je obrázek ze stejné domény jako portál
 * a export projde.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const obrazek = (await prisma.socialniObrazek.findFirst({
    where: { id: params.id, autorId: session.user.id },
    select: { url: true, nazev: true },
  })) as { url: string; nazev: string } | null;
  if (!obrazek) return NextResponse.json({ error: 'Obrázek nenalezen.' }, { status: 404 });

  if (obrazek.url.startsWith('data:')) {
    const carka = obrazek.url.indexOf(',');
    const typ = obrazek.url.slice(5, obrazek.url.indexOf(';'));
    const bytes = Buffer.from(obrazek.url.slice(carka + 1), 'base64');
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': typ || 'image/png', 'Cache-Control': 'private, max-age=3600' },
    });
  }

  const klic = klicZAdresyUloziste(obrazek.url);
  const odkaz = klic ? await podepsanyOdkazNaPrilohu(klic, obrazek.nazev) : obrazek.url;
  if (!odkaz) return NextResponse.json({ error: 'Obrázek se nepodařilo načíst.' }, { status: 500 });

  const res = await fetch(odkaz, { cache: 'no-store' });
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: 'Obrázek se nepodařilo načíst.' }, { status: 502 });
  }
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
