import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';

/**
 * „Tuhle stopu jsem doposlechl" (zadání 12. 9. 2026: „Přeposlechnuto — tam
 * bude počet tracků a kolik je z nich přeposlechnuto, třeba 3 z 24").
 *
 * Zapisuje se SAMO, jakmile přehrávání dojede na konec stopy. Klient nic
 * neodškrtává: odškrtávátko u každé stopy by byla práce navíc a lidé na ni
 * zapomínají — a číslo, které nikdo neudržuje, je horší než žádné.
 *
 * Zapsat smí každý, kdo se dostane k přeposlechu (i klient přes odkaz) —
 * je to údaj o poslechu, ne o výrobě. Stopa se pozná pořadím, stejně jako
 * u záznamů chyb, takže druhé doposlechnutí už nic nemění.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  trackIndex: z.number().int().min(1).max(500),
  trackName: z.string().trim().min(1).max(300),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await pristupKPreposlechu(params.id, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) return NextResponse.json({ error: pristup.message }, { status: pristup.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  try {
    const kdo = pristup.jmeno ?? (pristup.pres_odkaz ? 'Klient' : null);
    await prisma.preposlechStopa.upsert({
      where: {
        caflouProjectId_trackIndex: {
          caflouProjectId: params.id,
          trackIndex: parsed.data.trackIndex,
        },
      },
      // Nazev stopy muze prijit presnejsi nez pri prvnim zapisu; kdo a kdy
      // zustava ten prvni - zajima nas, kdy se stopa poslechla poprve.
      update: { trackName: parsed.data.trackName },
      create: {
        caflouProjectId: params.id,
        trackIndex: parsed.data.trackIndex,
        trackName: parsed.data.trackName,
        kdo,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Zapis preposlechnute stopy selhal:', err);
    return NextResponse.json({ error: 'Nepodařilo se to uložit.' }, { status: 500 });
  }
}
