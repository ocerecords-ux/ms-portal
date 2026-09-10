import { NextResponse } from 'next/server';
import { adresaAplikace, najdiAplikaci } from '@/lib/aplikace';
import { qrPng } from '@/lib/qr';

/**
 * QR kod ke stazeni jako PNG (zadani 10. 9. 2026).
 *
 * Aby se dal poslat mailem, vlepit do prezentace nebo vytisknout na papir.
 * Vydava se jen pro znamou aplikaci ze seznamu - schvalne se do QR nedava
 * libovolna adresa z parametru, jinak by stacilo poslat upraveny odkaz
 * a nas QR by vedl kamkoliv.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const co = new URL(request.url).searchParams.get('co') || '';
  const aplikace = najdiAplikaci(co);
  if (!aplikace) {
    return NextResponse.json({ error: 'Neznámá aplikace.' }, { status: 400 });
  }

  const png = await qrPng(adresaAplikace(aplikace));
  const soubor = `qr-${aplikace.klic}.png`;

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${soubor}"`,
      // Adresa se nemeni, ale drzet to v cache dlouho by znamenalo, ze po
      // pripadne zmene domeny by lidem visel stary kod.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
