import { NextRequest, NextResponse } from 'next/server';
import { najdiVAresu } from '@/lib/ares';
import { najdiPlatnou } from '@/lib/pozvankaUdaju';

/**
 * VYHLEDÁNÍ FIRMY V ARESU Z VEŘEJNÉHO FORMULÁŘE (zadání 16. 9. 2026:
 * „u firem IČ — tam jim to dovolí vyhledat z databáze ARES").
 *
 * Ptát se registru smí jen ten, kdo drží platný odkaz. Bez té podmínky by
 * z portálu byla veřejná čtečka ARESu pro kohokoliv.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const pozvanka = await najdiPlatnou(params.token);
  if (!pozvanka) return NextResponse.json({ error: 'Odkaz už neplatí.' }, { status: 404 });

  const vysledek = await najdiVAresu(req.nextUrl.searchParams.get('ico'));
  if (!vysledek.ok) {
    return NextResponse.json({ error: vysledek.chyba }, { status: vysledek.status });
  }
  return NextResponse.json(vysledek.udaje);
}
