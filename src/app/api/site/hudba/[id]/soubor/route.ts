import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { smiPoslatPribeh, smiSchvalovatPribehy } from '@/lib/pribehyServer';
import { nactiSkladbu } from '@/lib/hudbaServer';
import { klicZAdresyUloziste, stahniZUloziste } from '@/lib/storage';

/**
 * BAJTY SKLADBY (8. 10. 2026).
 *
 * TADY SE PŘESMĚROVAT NEDÁ, na rozdíl od souboru příběhu. Editor si skladbu
 * musí `fetch`nout a prohnat přes `decodeAudioData`, aby ji mohl namíchat do
 * videa - a na podepsanou adresu úložiště skript z prohlížeče nedosáhne,
 * protože odpověď nemá hlavičky CORS. Proto jdou bajty skrz portál.
 *
 * ZATO SE CACHUJE. Skladba se během skládání příběhu načte několikrát
 * (poslech, posun začátku, nahrávání) a je to vždycky týž soubor, takže
 * prohlížeč si ji nechá na den. Bez toho by každé šťouchnutí do posuvníku
 * stálo další megabajty přenosu.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const kdo = { id: session.user.id, role: session.user.role };
  if (!(await smiPoslatPribeh(kdo)) && !(await smiSchvalovatPribehy(kdo))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const skladba = await nactiSkladbu(params.id);
  if (!skladba) return NextResponse.json({ error: 'Skladba nenalezena.' }, { status: 404 });

  const klic = klicZAdresyUloziste(skladba.url);
  if (!klic) return NextResponse.json({ error: 'Soubor není v úložišti.' }, { status: 404 });

  const soubor = await stahniZUloziste(klic);
  if (!soubor) return NextResponse.json({ error: 'Soubor se nepodařilo načíst.' }, { status: 500 });

  return new NextResponse(new Uint8Array(soubor.bytes), {
    headers: {
      'Content-Type': soubor.mime || skladba.typSouboru || 'audio/mpeg',
      'Cache-Control': 'private, max-age=86400, immutable',
    },
  });
}
