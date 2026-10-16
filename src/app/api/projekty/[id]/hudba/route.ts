import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { nactiHudbu, zapisSkladbu } from '@/lib/hudbaProjektuServer';

/**
 * HUDBA U PROJEKTU (zadání 16. 10. 2026).
 *
 * JEN NÁŠ TÝM (rozhodnuto 16. 10. 2026) - klient o kartě neví, stejně jako
 * o natáčecím plánu.
 *
 * Tady NEJDE SOUBOR, jen záznam o něm. Samotný WAV putuje z prohlížeče rovnou
 * do Dropboxu (viz podpis/route.ts a lib/dropbox.ts) - přes Vercel by
 * padesátimegový soubor neprošel.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  cesta: z.string().trim().min(1),
  nazev: z.string().trim().max(200),
  zdroj: z.string().trim().max(120).optional(),
  poznamka: z.string().trim().max(500).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const { id } = await params;
  return NextResponse.json({ hudba: await nactiHudbu(id) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const { id } = await params;
  const skladba = await zapisSkladbu({
    caflouProjectId: id,
    cesta: parsed.data.cesta,
    nazev: parsed.data.nazev,
    zdroj: parsed.data.zdroj ?? null,
    poznamka: parsed.data.poznamka ?? null,
    pridalId: session.user.id,
  });

  if (!skladba) {
    // Soubor na té cestě v Dropboxu není - radši nahlas než tiše zapsat
    // skladbu, která nikde neleží.
    return NextResponse.json(
      { error: 'Soubor se v Dropboxu nenašel. Zkuste nahrát znovu.' },
      { status: 502 },
    );
  }
  return NextResponse.json({ skladba }, { status: 201 });
}
