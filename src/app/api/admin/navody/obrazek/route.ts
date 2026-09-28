import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { uploadPripominkaObrazek } from '@/lib/storage';

/**
 * OBRÁZEK DO NÁVODU NEBO PROCESU (zadání 28. 9. 2026: „aby se tam dal psát
 * manuál na nějaký software a vkládat k textu obrázky - printscreeny").
 *
 * Soubor jde do úložiště a zpátky se vrátí jen adresa, kterou editor vloží
 * do textu jako `![popis](adresa)`. Obrázky se tedy vedou stejně jako
 * v připomínkách - žádné nové úložiště kvůli tomu nevzniká.
 *
 * PROČ NE ROVNOU DO TEXTU JAKO data: URL: printscreen má klidně 300 kB
 * a v Markdownu by ho nesl každý načtený článek znovu. Adresa má padesát
 * znaků a prohlížeč si obrázek nechá v mezipaměti.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Osm megabajtů; printscreen z 5K monitoru se vejde i nekomprimovaný. */
const MAX_BAJTU = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  const soubor = formData?.get('obrazek');
  if (!(soubor instanceof File) || soubor.size === 0) {
    return NextResponse.json({ error: 'Nepřišel žádný obrázek.' }, { status: 400 });
  }
  if (!soubor.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Tohle není obrázek.' }, { status: 400 });
  }
  if (soubor.size > MAX_BAJTU) {
    return NextResponse.json(
      { error: 'Obrázek je moc velký - ořízněte ho jen na tu část obrazovky, o kterou jde.' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await soubor.arrayBuffer());
  const vysledek = await uploadPripominkaObrazek(buffer, soubor.name || 'obrazek.png', soubor.type);
  if ('error' in vysledek) {
    return NextResponse.json({ error: vysledek.error }, { status: 400 });
  }
  return NextResponse.json({ url: vysledek.url, nazev: vysledek.name }, { status: 201 });
}
