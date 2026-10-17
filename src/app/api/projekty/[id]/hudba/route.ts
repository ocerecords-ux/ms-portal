import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { nactiHudbu, zapisSkladbu } from '@/lib/hudbaProjektuServer';
import { overPrilohu } from '@/lib/storage';

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

/**
 * NAZEV, AUTOR, DELKA I OBAL PRICHAZEJI Z PROHLIZECE (17. 10. 2026).
 * Precetl je z metadat souboru (lib/metadataHudby.ts) - server ten soubor
 * nikdy nevidi, takze jinam nez sem se dostat nemuzou. Obal uz v ulozisti
 * lezi, posila se jen jeho klic a overi se, ze tam opravdu je.
 */
const schema = z.object({
  cesta: z.string().trim().min(1),
  nazev: z.string().trim().max(200),
  autor: z.string().trim().max(200).nullable().optional(),
  delkaS: z.number().int().min(0).max(24 * 3600).optional(),
  obalKlic: z.string().trim().max(300).nullable().optional(),
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

  // Klic obalu prisel z prohlizece - bez overeni by v karte visel odkaz na
  // obrazek, ktery v ulozisti neni (stejny duvod jako u priloh objednavky).
  const obalKlic = parsed.data.obalKlic?.trim() || null;
  const obalOvereny = obalKlic && (await overPrilohu(obalKlic)) ? obalKlic : null;

  const skladba = await zapisSkladbu({
    caflouProjectId: id,
    cesta: parsed.data.cesta,
    nazev: parsed.data.nazev,
    autor: parsed.data.autor ?? null,
    delkaS: parsed.data.delkaS ?? 0,
    obalKlic: obalOvereny,
    poznamka: parsed.data.poznamka ?? null,
    puvod: 'my',
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

  // Načte se znovu celá karta, aby se k nové skladbě rovnou vrátilo i to,
  // jestli tatáž hudba nehraje u jiného projektu (17. 10. 2026).
  const sKolizemi = (await nactiHudbu(id)).find((s) => s.id === skladba.id) ?? skladba;
  return NextResponse.json({ skladba: sKolizemi }, { status: 201 });
}
