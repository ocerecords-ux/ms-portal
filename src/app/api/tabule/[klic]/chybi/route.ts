import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { KLICE_POLOZEK } from '@/lib/tabule';
import { oznamChybi, studioPodleKlice } from '@/lib/tabuleServer';

/**
 * Co chybí ve studiu (21. 9. 2026). POST { polozka, chybi: true|false }.
 * Nové nahlášení pošle zprávu Báře Šiblové; opakované ťuknutí na už
 * nahlášenou věc nic dalšího neposílá. chybi:false = doplněno.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { klic: string } }) {
  const studio = await studioPodleKlice(params.klic);
  if (!studio) return NextResponse.json({ error: 'Tabule neexistuje.' }, { status: 404 });
  const telo = (await req.json().catch(() => null)) as { polozka?: unknown; chybi?: unknown } | null;
  const polozka = typeof telo?.polozka === 'string' ? telo.polozka : '';
  if (!KLICE_POLOZEK.includes(polozka)) return NextResponse.json({ error: 'Neznámá položka.' }, { status: 400 });

  const aktivni = await prisma.studioChybi.findFirst({
    where: { studioId: studio.id, polozka, doplnenoAt: null },
    select: { id: true },
  });

  if (telo?.chybi === false) {
    if (aktivni) await prisma.studioChybi.update({ where: { id: aktivni.id }, data: { doplnenoAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (!aktivni) {
    await prisma.studioChybi.create({ data: { studioId: studio.id, polozka } });
    await oznamChybi(studio.name, polozka);
  }
  return NextResponse.json({ ok: true });
}
