import { NextRequest, NextResponse } from 'next/server';
import { nactiTabuli, studioPodleKlice } from '@/lib/tabuleServer';

/**
 * Data tabule ve studiu (zadání 21. 9. 2026) - dnešní program, poznámky a co
 * chybí. Bez přihlášení, pozná se klíčem v adrese. Tabule se ptá každých
 * pár desítek vteřin.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { klic: string } }) {
  const studio = await studioPodleKlice(params.klic);
  if (!studio) return NextResponse.json({ error: 'Tabule neexistuje.' }, { status: 404 });
  try {
    return NextResponse.json(await nactiTabuli(studio), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Tabule se nepodařilo načíst:', err);
    return NextResponse.json({ error: 'Tabule se nepodařilo načíst.' }, { status: 500 });
  }
}
