import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadPripominkaObrazek } from '@/lib/storage';
import { nactiObrazky, smiSite } from '@/lib/socialniServer';

/**
 * OBRÁZKY DO PŘÍSPĚVKŮ (zadání 27. 9. 2026). Prohlížeč obrázek před
 * odesláním zmenší, takže sem chodí stovky kB, ne fotky z foťáku.
 *
 * Ukládá se do S3/R2 pod náhodným klíčem (a bez něj jako data URL do
 * databáze) - stejně jako printscreeny u připomínek.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 8 * 1024 * 1024;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  return NextResponse.json({ obrazky: await nactiObrazky(session.user.id) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const soubor = form?.get('soubor');
  if (!(soubor instanceof File)) {
    return NextResponse.json({ error: 'Chybí soubor.' }, { status: 400 });
  }
  if (!soubor.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Tohle není obrázek.' }, { status: 400 });
  }
  if (soubor.size > MAX) {
    return NextResponse.json({ error: 'Obrázek je moc velký.' }, { status: 400 });
  }

  const sirka = Number(form?.get('sirka')) || null;
  const vyska = Number(form?.get('vyska')) || null;
  const buffer = Buffer.from(await soubor.arrayBuffer());
  const ulozeno = await uploadPripominkaObrazek(buffer, soubor.name || 'obrazek.png', soubor.type);
  if ('error' in ulozeno) return NextResponse.json({ error: ulozeno.error }, { status: 400 });

  const zaznam = (await prisma.socialniObrazek.create({
    data: {
      autorId: session.user.id,
      nazev: soubor.name || 'obrázek',
      url: ulozeno.url,
      sirka,
      vyska,
    },
    select: { id: true, nazev: true, sirka: true, vyska: true },
  })) as { id: string; nazev: string; sirka: number | null; vyska: number | null };

  return NextResponse.json({ obrazek: zaznam });
}
