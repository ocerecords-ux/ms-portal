import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { zapisTagy, prectiTagy } from '@/lib/id3';
import { prepisObsahSouboru, stahniSoubor } from '@/lib/googleDrive';
import { nactiTagy, spolecneTagy, tagovaniPovoleno } from '@/lib/tagyServer';

/**
 * ZÁPIS TAGŮ DO JEDNOHO SOUBORU (zadání 14. 10. 2026).
 *
 * PO JEDNÉ STOPĚ, NE CELÁ KNIHA NARÁZ. Soubor se musí stáhnout do paměti,
 * přelepit značkou a nahrát zpátky; dvacet hodinových stop v jednom požadavku
 * by narazilo na čas i paměť funkce. Stránka proto volá tuhle cestu stopu po
 * stopě a ukazuje, jak to jde - a když jedna spadne, zbytek je hotový.
 *
 * SOUBOR SE NEPŘEKÓDOVÁVÁ. Mění se jen značka na začátku, zvuková data zůstanou
 * bajt po bajtu stejná (viz lib/id3.ts).
 *
 * Co se zapíše, se zároveň ULOŽÍ u projektu - aby druhý zápis nevyžadoval
 * znovu vyplňovat formulář a aby bylo vidět, co v souboru je.
 */
export const dynamic = 'force-dynamic';
// Stažení a nahrání velké stopy chvíli trvá; výchozích pár vteřin nestačí.
export const maxDuration = 300;

const schema = z.object({
  driveFileId: z.string().trim().min(5).max(200),
  /** Složka, ve které se stopa má hledat - kvůli ověření, že k projektu patří. */
  slozka: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  if (!(await tagovaniPovoleno(params.id))) {
    return NextResponse.json({ error: 'Tagování není u firmy tohohle projektu zapnuté.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }
  const { driveFileId, slozka } = parsed.data;

  // Stopa musí být ve složce projektu - jinak by šlo přepsat cokoliv na Disku,
  // k čemu portál má přístup.
  const obsah = await nactiTagy(params.id, slozka);
  if (!obsah.ok) return NextResponse.json({ error: obsah.duvod }, { status: 400 });
  const stopa = obsah.stopy.find((s) => s.driveFileId === driveFileId);
  if (!stopa) {
    return NextResponse.json({ error: 'Tahle stopa ve složce projektu není.' }, { status: 404 });
  }

  const spolecne = await spolecneTagy(params.id);

  const stazeno = await stahniSoubor(driveFileId);
  if (!stazeno.ok) return NextResponse.json({ error: stazeno.duvod }, { status: 502 });

  const novy = zapisTagy(stazeno.bytes, {
    title: stopa.title,
    artist: spolecne.autor,
    albumArtist: spolecne.interpret,
    album: spolecne.album,
    rok: spolecne.rok,
    zanr: spolecne.zanr,
    cislo: stopa.cislo,
    celkem: obsah.stopy.length,
    vydavatel: spolecne.vydavatel,
  });

  const nahrano = await prepisObsahSouboru(driveFileId, novy, 'audio/mpeg');
  if (!nahrano.ok) return NextResponse.json({ error: nahrano.duvod }, { status: 502 });

  const ted = new Date();
  try {
    await prisma.tagStopa.upsert({
      where: { caflouProjectId_driveFileId: { caflouProjectId: params.id, driveFileId } },
      create: {
        caflouProjectId: params.id,
        driveFileId,
        nazevSouboru: stopa.nazevSouboru,
        cislo: stopa.cislo,
        title: stopa.title,
        zapsanoAt: ted,
      },
      update: { nazevSouboru: stopa.nazevSouboru, cislo: stopa.cislo, title: stopa.title, zapsanoAt: ted },
    });
    await prisma.projectMeta.update({
      where: { caflouProjectId: params.id },
      data: { tagyZapsanoAt: ted },
    });
  } catch (err) {
    // Soubor na Disku už otagovaný je - na tom poznámka v databázi nic nemění.
    console.error('Tagy: zapis poznamky o stope selhal:', err);
  }

  return NextResponse.json({ ok: true, zapsanoAt: ted.toISOString(), tagy: prectiTagy(novy) });
}
