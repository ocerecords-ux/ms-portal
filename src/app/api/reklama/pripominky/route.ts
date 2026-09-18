import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { nactiPripominky, pristupKVideu } from '@/lib/reklamaPripominky';

/**
 * Připomínky klienta k reklamnímu videu (zadání 18. 9. 2026).
 *
 * Bez přihlašování - vstupenkou je token projektu v adrese (`?k=`), stejně
 * jako u nahrávek a přeposlechu. Co smí dovnitř, hlídá lib/reklamaPripominky.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  k: z.string().trim().min(10),
  soubor: z.string().trim().min(5),
  cas: z.number().min(0).max(86400),
  text: z.string().trim().min(1, 'Napište, co je potřeba upravit.').max(2000),
});

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('k') ?? '';
  const soubor = req.nextUrl.searchParams.get('soubor') ?? '';
  if (!token || !soubor) return NextResponse.json({ error: 'Chybí odkaz.' }, { status: 400 });

  const pristup = await pristupKVideu(token, soubor);
  if ('chyba' in pristup) {
    return NextResponse.json({ error: pristup.chyba }, { status: pristup.status });
  }

  const pripominky = await nactiPripominky(pristup.caflouProjectId, pristup.fileId);
  return NextResponse.json(
    { pripominky },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { k, soubor, cas, text } = parsed.data;

  const pristup = await pristupKVideu(k, soubor);
  if ('chyba' in pristup) {
    return NextResponse.json({ error: pristup.chyba }, { status: pristup.status });
  }

  try {
    const zapis = await prisma.reklamaPripominka.create({
      data: {
        caflouProjectId: pristup.caflouProjectId,
        driveFileId: pristup.fileId,
        driveFileName: pristup.nazev,
        cas,
        text,
      },
    });

    /**
     * ZVONEK TU ZÁMĚRNĚ NECINKÁ (upřesnění 18. 9. 2026: „pak tam bude jen
     * tlačítko odeslat připomínky"). Klient si spot projde, zapíše k němu
     * třeba deset věcí - a teprve tlačítkem je pošle. Deset upozornění za
     * sebou by z toho udělalo šum a člověk by si je přestal číst.
     * Viz /api/reklama/pripominky/odeslat.
     */
    return NextResponse.json(
      {
        id: zapis.id,
        cas: zapis.cas,
        text: zapis.text,
        autorJmeno: zapis.autorJmeno,
        vyrizeno: zapis.vyrizeno,
        odeslanoAt: null,
        createdAt: zapis.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Zapis pripominky k videu selhal:', err);
    return NextResponse.json({ error: 'Připomínku se nepodařilo uložit.' }, { status: 500 });
  }
}
