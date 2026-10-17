import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { dropboxNastaven } from '@/lib/dropbox';
import { pripravNahraniSerie } from '@/lib/hudbaSerieServer';
import { isInternalRole } from '@/lib/roles';

/**
 * JEDNORÁZOVÁ ADRESA NA NAHRÁNÍ HUDBY SÉRIE (17. 10. 2026).
 *
 * Stejný důvod jako u projektu: padesátimegový WAV přes Vercel neprojde,
 * takže soubor jde z prohlížeče rovnou do Dropboxu. Adresu vydá Dropbox,
 * platí čtyři hodiny a vede na jedno konkrétní místo ve složce série.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  serie: z.string().trim().min(1).max(200),
  nazev: z.string().trim().min(1).max(260),
  velikost: z.number().int().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  if (!dropboxNastaven()) {
    return NextResponse.json({ error: 'Dropbox není nastavený.' }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const pripraveno = await pripravNahraniSerie({
    serie: parsed.data.serie,
    nazevSouboru: parsed.data.nazev,
  });
  if ('chyba' in pripraveno) {
    return NextResponse.json({ error: pripraveno.chyba }, { status: 502 });
  }
  return NextResponse.json(pripraveno);
}
