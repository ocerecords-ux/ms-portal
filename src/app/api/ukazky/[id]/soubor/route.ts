import { NextRequest, NextResponse } from 'next/server';
import { nactiUkazku } from '@/lib/ukazkyServer';
import { klicZAdresyUloziste, stahniZUloziste } from '@/lib/storage';

/**
 * BAJTY UKÁZKY (11. 10. 2026).
 *
 * VEŘEJNÉ BEZ PŘIHLÁŠENÍ, a schválně. Nabídkovou prezentaci otevírá klient,
 * který u nás účet nemá, a ukázky jsou přesně to, co mu chceme pustit -
 * jsou to naše reference a dema herců, ne klientský materiál. Vyřazená
 * ukázka se ale nevydává: vyřazení je způsob, jak nahrávku stáhnout z oběhu.
 *
 * BAJTY JDOU SKRZ PORTÁL, nepřesměrovává se do úložiště. Zvuková křivka
 * v přehrávači se kreslí z `fetch`e a na podepsanou adresu úložiště skript
 * z prohlížeče nedosáhne (chybí hlavičky CORS); přes portál je to tatáž
 * adresa jako stránka.
 *
 * PODPORUJE RANGE. Bez toho se v delší ukázce nedá přeskočit a video se
 * v některých prohlížečích vůbec nerozjede.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ukazka = await nactiUkazku(params.id);
  if (!ukazka || !ukazka.aktivni) {
    return NextResponse.json({ error: 'Ukázka nenalezena.' }, { status: 404 });
  }

  const klic = klicZAdresyUloziste(ukazka.url);
  if (!klic) return NextResponse.json({ error: 'Soubor není v úložišti.' }, { status: 404 });

  const soubor = await stahniZUloziste(klic);
  if (!soubor) return NextResponse.json({ error: 'Soubor se nepodařilo načíst.' }, { status: 500 });

  const typ = soubor.mime || ukazka.typSouboru || 'audio/mpeg';
  const celkem = soubor.bytes.length;
  /** Ukázky se nemění - když už je klient jednou stáhl, ať je nestahuje znovu. */
  const cache = 'public, max-age=86400, immutable';

  const range = req.headers.get('range');
  const shoda = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (shoda) {
    const od = shoda[1] ? Number(shoda[1]) : 0;
    const doKonce = shoda[2] ? Number(shoda[2]) : celkem - 1;
    if (!Number.isFinite(od) || od >= celkem || od < 0) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${celkem}`, 'Accept-Ranges': 'bytes' },
      });
    }
    const konec = Math.min(Number.isFinite(doKonce) ? doKonce : celkem - 1, celkem - 1);
    const vyrez = soubor.bytes.subarray(od, konec + 1);
    return new NextResponse(new Uint8Array(vyrez), {
      status: 206,
      headers: {
        'Content-Type': typ,
        'Content-Length': String(vyrez.length),
        'Content-Range': `bytes ${od}-${konec}/${celkem}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache,
      },
    });
  }

  return new NextResponse(new Uint8Array(soubor.bytes), {
    headers: {
      'Content-Type': typ,
      'Content-Length': String(celkem),
      'Accept-Ranges': 'bytes',
      'Cache-Control': cache,
    },
  });
}
