import { NextRequest, NextResponse } from 'next/server';
import { nactiZDisku } from '@/lib/preposlechDriveServer';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';
import { prisma } from '@/lib/db';

/**
 * Stopy a text pro přeposlech, načtené ze složky projektu na Disku
 * (zadání 11. 9. 2026). Nic se nikam nekopíruje - vrací se jen seznam
 * a přehrává se proudem přes /soubor.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await pristupKPreposlechu(params.id, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) return NextResponse.json({ error: pristup.message }, { status: pristup.status });

  const vysledek = await nactiZDisku(params.id);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.duvod }, { status: 409 });

  // POČET STOP SI PAMATUJEME (zadání 12. 9. 2026: sloupec „K přeposlechu"
  // v klientském přehledu). Seznam projektů se na Disk neptá - u padesáti
  // projektů by to bylo padesát dotazů do Google API při každém otevření.
  // Tady už složku v ruce máme, takže stačí zapsat, co v ní je.
  //
  // Bez await: zápis nemá zdržovat načtení stop, a když se nepovede, ukáže se
  // jen starší počet.
  void prisma.preposlechStav
    .upsert({
      where: { caflouProjectId: params.id },
      update: { pocetStop: vysledek.stopy.length, stopyZjistenyAt: new Date() },
      create: { caflouProjectId: params.id, pocetStop: vysledek.stopy.length, stopyZjistenyAt: new Date() },
    })
    .catch((err) => console.error('Ulozeni poctu stop selhalo:', err));

  return NextResponse.json({
    slozkaUrl: vysledek.slozkaUrl,
    stopy: vysledek.stopy,
    text: vysledek.text,
    poznamkaKTextu: vysledek.poznamkaKTextu,
  });
}
