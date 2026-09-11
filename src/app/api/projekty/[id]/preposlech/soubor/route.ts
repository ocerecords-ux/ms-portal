import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/googleDrive';
import { nactiZDisku } from '@/lib/preposlechDriveServer';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';

/**
 * Výdej jednoho souboru ze složky projektu pro přeposlech (zadání 11. 9.
 * 2026).
 *
 * Posílá se PROUDEM a s podporou Range, aby přehrávač uměl skákat v nahrávce
 * a nemusel stahovat hodinovou stopu celou, než začne hrát. Soubor se vydá
 * jen tehdy, když je opravdu mezi stopami nebo textem toho projektu - ID
 * chodí z prohlížeče, takže se ověřuje proti čerstvému seznamu ze složky.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await pristupKPreposlechu(params.id, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) return NextResponse.json({ error: pristup.message }, { status: pristup.status });

  const fileId = req.nextUrl.searchParams.get('soubor');
  if (!fileId) return NextResponse.json({ error: 'Chybí ID souboru.' }, { status: 400 });

  const obsah = await nactiZDisku(params.id);
  if (!obsah.ok) return NextResponse.json({ error: obsah.duvod }, { status: 409 });

  const stopa = obsah.stopy.find((s) => s.id === fileId);
  const jeText = obsah.text?.id === fileId;
  if (!stopa && !jeText) {
    return NextResponse.json({ error: 'Soubor k tomuto projektu nepatří.' }, { status: 403 });
  }

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
  hlavicky.set('Content-Type', odpoved.headers.get('content-type') || stopa?.mime || 'application/octet-stream');
  for (const klic of ['content-length', 'content-range', 'accept-ranges']) {
    const hodnota = odpoved.headers.get(klic);
    if (hodnota) hlavicky.set(klic, hodnota);
  }
  hlavicky.set('Cache-Control', 'private, max-age=600');
  hlavicky.set('Content-Disposition', 'inline');

  return new NextResponse(odpoved.body, { status: odpoved.status, headers: hlavicky });
}
