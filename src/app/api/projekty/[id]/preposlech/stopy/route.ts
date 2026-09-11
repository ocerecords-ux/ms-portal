import { NextRequest, NextResponse } from 'next/server';
import { nactiZDisku } from '@/lib/preposlechDriveServer';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';

/**
 * Stopy a text pro přeposlech, načtené ze složky projektu na Disku
 * (zadání 11. 9. 2026). Nic se nikam nekopíruje - vrací se jen seznam
 * a přehrává se proudem přes /soubor.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await pristupKPreposlechu(params.id);
  if (!pristup.ok) return NextResponse.json({ error: pristup.message }, { status: pristup.status });

  const vysledek = await nactiZDisku(params.id);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.duvod }, { status: 409 });

  return NextResponse.json({
    slozkaUrl: vysledek.slozkaUrl,
    stopy: vysledek.stopy,
    text: vysledek.text,
    poznamkaKTextu: vysledek.poznamkaKTextu,
  });
}
