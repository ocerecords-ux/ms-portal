import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { nahledDokladu, type RozepsanyDoklad } from '@/lib/dokladNahledServer';

/**
 * Náhled rozepsané faktury nebo nabídky (zadání 10. 9. 2026). Nic neukládá,
 * jen vrátí PDF z hodnot, které má člověk zrovna ve formuláři - proto POST
 * a proto se to nikde necachuje.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Doklady vidi jen Zuzo-labuzo - stejna ochrana jako u ostatnich endpointu
  // v teto sekci.
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  let telo: RozepsanyDoklad;
  try {
    telo = (await req.json()) as RozepsanyDoklad;
  } catch {
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  }
  if (telo?.druh !== 'FAKTURA' && telo?.druh !== 'NABIDKA') {
    return NextResponse.json({ error: 'Neznámý druh dokladu.' }, { status: 400 });
  }

  const vysledek = await nahledDokladu(telo);
  if (!vysledek.ok) {
    return NextResponse.json({ error: vysledek.message }, { status: 409 });
  }

  return new NextResponse(vysledek.pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="nahled.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
