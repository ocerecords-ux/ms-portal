import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { nactiPribehy, smiPoslatPribeh, zalozPribeh } from '@/lib/pribehyServer';
import { MAX_POPISEK, POVOLENE_TYPY, maxProTyp, velikostVMB } from '@/lib/pribehy';
import { adresaVUlozisti, overPrilohu } from '@/lib/storage';

/**
 * FRONTA PŘÍBĚHŮ (zadání 6. 10. 2026).
 *
 * GET vrátí frontu - schvalovateli celou, ostatním jen jejich vlastní.
 * POST zapíše příběh K SOUBORU, KTERÝ UŽ LEŽÍ V ÚLOŽIŠTI: prohlížeč si
 * předtím vyžádal podepsanou adresu (/api/site/pribehy/podpis) a nahrál ho
 * tam sám. Velikost a typ se čtou z úložiště, ne z toho, co hlásí prohlížeč.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  klic: z.string().trim().min(1).max(512),
  nazevSouboru: z.string().trim().min(1).max(255),
  popisek: z.string().max(MAX_POPISEK).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const kdo = { id: session.user.id, role: session.user.role };
  return NextResponse.json({ pribehy: await nactiPribehy(kdo) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const kdo = { id: session.user.id, role: session.user.role };
  if (!(await smiPoslatPribeh(kdo))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatný příběh.' }, { status: 400 });
  }
  const { klic, nazevSouboru, popisek } = parsed.data;

  // Ověření v úložišti, ne důvěra prohlížeči: klíč mohl zůstat nenahraný.
  const soubor = await overPrilohu(klic);
  if (!soubor) {
    return NextResponse.json({ error: 'Soubor se do úložiště nedostal. Zkuste to znovu.' }, { status: 400 });
  }
  if (!POVOLENE_TYPY.includes(soubor.mime)) {
    return NextResponse.json(
      { error: 'Instagram vezme jen JPEG, PNG, WEBP, MP4 nebo MOV.' },
      { status: 400 },
    );
  }
  const strop = maxProTyp(soubor.mime);
  if (soubor.size > strop) {
    return NextResponse.json(
      { error: `Soubor je moc velký - vejde se do ${velikostVMB(strop)}.` },
      { status: 400 },
    );
  }
  const url = adresaVUlozisti(klic);
  if (!url) {
    return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });
  }

  const pribeh = await zalozPribeh(kdo, {
    url,
    nazevSouboru,
    typSouboru: soubor.mime,
    velikost: soubor.size,
    popisek: (popisek ?? '').trim(),
  });
  return NextResponse.json({ pribeh });
}
