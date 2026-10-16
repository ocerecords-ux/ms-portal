import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { dropboxNastaven } from '@/lib/dropbox';
import { pripravNahrani } from '@/lib/hudbaProjektuServer';

/**
 * ADRESA, NA KTEROU PROHLÍŽEČ POŠLE SOUBOR (zadání 16. 10. 2026).
 *
 * Soubor NEJDE přes portál - funkce na Vercelu mají strop kolem 4,5 MB
 * a jeden WAV má kolem padesáti. Prohlížeč si tu vyžádá jednorázovou adresu
 * a nahraje soubor rovnou do Dropboxu; portál pak u skladby jen ověří, že tam
 * opravdu leží. Stejný postup jako u příloh v chatu.
 *
 * CESTU URČUJE VÝHRADNĚ SERVER. Kdyby ji posílal prohlížeč, dala by se jí
 * přepsat cizí nahrávka kdekoliv v Dropboxu.
 */
export const dynamic = 'force-dynamic';

/** Nad tohle už to není hudba do spotu, ale omyl. */
const MAX_BYTES = 300 * 1024 * 1024;

const schema = z.object({
  nazev: z.string().trim().min(1).max(255),
  velikost: z.number().int().positive().max(MAX_BYTES, 'Soubor je moc velký.'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  if (!dropboxNastaven()) {
    // Radši rovnou a nahlas, než aby soubor tiše zmizel.
    return NextResponse.json(
      { error: 'Hudba zatím nejde - portál nemá nastavené napojení na Dropbox.' },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }

  const { id } = await params;
  const meta = await prisma.projectMeta
    .findUnique({ where: { caflouProjectId: id }, select: { name: true } })
    .catch(() => null);

  const pripraveno = await pripravNahrani({
    nazevProjektu: (meta as { name: string | null } | null)?.name ?? id,
    nazevSouboru: parsed.data.nazev,
  });

  if ('chyba' in pripraveno) {
    // Důvod jde rovnou do karty - „Dropbox adresu nevydal" nikomu nepomohlo.
    return NextResponse.json({ error: pripraveno.chyba }, { status: 502 });
  }
  return NextResponse.json(pripraveno);
}
