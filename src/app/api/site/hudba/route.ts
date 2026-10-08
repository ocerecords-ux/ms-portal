import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { smiPoslatPribeh, smiSchvalovatPribehy } from '@/lib/pribehyServer';
import { nactiHudbu, zalozSkladbu } from '@/lib/hudbaServer';
import { MAX_HUDBA_BYTES, TYPY_HUDBY } from '@/lib/hudba';
import { adresaVUlozisti } from '@/lib/storage';

/**
 * KNIHOVNA HUDBY DO PŘÍBĚHŮ (zadání 8. 10. 2026).
 *
 * ČÍST SMÍ KAŽDÝ, KDO SMÍ POSLAT PŘÍBĚH - jinak by si neměl z čeho vybrat.
 * NAHRÁVAT SMÍ JEN PRODUKCE (smiSchvalovatPribehy): knihovna je společná
 * a za to, co se smí vypálit do firemního příběhu, někdo odpovídá.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(160),
  autor: z.string().trim().max(160).default(''),
  klic: z.string().trim().min(1).max(400),
  nazevSouboru: z.string().trim().min(1).max(255),
  typSouboru: z.string().trim().max(160),
  velikost: z.number().int().positive().max(MAX_HUDBA_BYTES),
  delka: z.number().int().min(0).max(60 * 60),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const kdo = { id: session.user.id, role: session.user.role };
  const smiSpravovat = await smiSchvalovatPribehy(kdo);
  if (!smiSpravovat && !(await smiPoslatPribeh(kdo))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  // Správce vidí i vypnuté skladby, aby je mohl zase zapnout.
  return NextResponse.json({ skladby: await nactiHudbu(smiSpravovat), smiSpravovat });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (!(await smiSchvalovatPribehy({ id: session.user.id, role: session.user.role }))) {
    return NextResponse.json({ error: 'Skladby do knihovny přidává produkce.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  if (!TYPY_HUDBY.includes(parsed.data.typSouboru)) {
    return NextResponse.json({ error: 'Tenhle typ souboru jako hudbu nebereme.' }, { status: 400 });
  }

  // Klíč zná jen ten, komu ho server sám podepsal - adresa se z něj
  // poskládá tady, ať ji prohlížeč nemůže podstrčit.
  const url = adresaVUlozisti(parsed.data.klic);
  if (!url) return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });

  const skladba = await zalozSkladbu(session.user.id, {
    nazev: parsed.data.nazev,
    autor: parsed.data.autor,
    url,
    nazevSouboru: parsed.data.nazevSouboru,
    typSouboru: parsed.data.typSouboru,
    velikost: parsed.data.velikost,
    delka: parsed.data.delka,
  });
  return NextResponse.json({ skladba }, { status: 201 });
}
