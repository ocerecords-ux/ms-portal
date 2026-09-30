import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/googleDrive';
import { souborPreposlechu } from '@/lib/preposlechDriveServer';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';

/**
 * Výdej jednoho souboru ze složky projektu pro přeposlech (zadání 11. 9.
 * 2026).
 *
 * Posílá se PROUDEM a s podporou Range, aby přehrávač uměl skákat v nahrávce
 * a nemusel stahovat hodinovou stopu celou, než začne hrát. Soubor se vydá
 * jen tehdy, když je opravdu mezi stopami nebo textem toho projektu - ID
 * chodí z prohlížeče, takže se ověřuje proti seznamu ze složky.
 *
 * Ten seznam se drží krátce v paměti (viz souborPreposlechu). Prohlížeč si
 * o nahrávku říká po kouscích a jeden poslech jich pošle desítky; načítat
 * kvůli každému z nich znovu celou složku na Disku byl hlavní důvod, proč se
 * AudioTagger rozjížděl osm až deset vteřin (30. 9. 2026).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await pristupKPreposlechu(params.id, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) return NextResponse.json({ error: pristup.message }, { status: pristup.status });

  const fileId = req.nextUrl.searchParams.get('soubor');
  if (!fileId) return NextResponse.json({ error: 'Chybí ID souboru.' }, { status: 400 });

  const soubor = await souborPreposlechu(params.id, fileId);
  if (!soubor.ok) return NextResponse.json({ error: soubor.duvod }, { status: soubor.status });

  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Napojení na Disk není nastavené.' }, { status: 503 });

  const rozsah = req.headers.get('range');
  const odpoved = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}`, ...(rozsah ? { Range: rozsah } : {}) } },
  );

  if (!odpoved.ok || !odpoved.body) {
    console.error('Vydej souboru pro preposlech selhal:', odpoved.status);
    return NextResponse.json({ error: 'Soubor se nepodařilo načíst.' }, { status: 502 });
  }

  const hlavicky = new Headers();
  hlavicky.set('Content-Type', odpoved.headers.get('content-type') || soubor.mime || 'application/octet-stream');
  for (const klic of ['content-length', 'content-range', 'accept-ranges']) {
    const hodnota = odpoved.headers.get(klic);
    if (hodnota) hlavicky.set(klic, hodnota);
  }
  hlavicky.set('Cache-Control', 'private, max-age=600');
  hlavicky.set('Content-Disposition', 'inline');

  return new NextResponse(odpoved.body, { status: odpoved.status, headers: hlavicky });
}
