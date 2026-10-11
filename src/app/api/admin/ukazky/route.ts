import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { MAX_UKAZKA_BYTES, SEKCE, TYPY_UKAZEK } from '@/lib/prezentaceNabidky';
import { nactiKnihovnu, zalozUkazku } from '@/lib/ukazkyServer';
import { overPrilohu } from '@/lib/storage';

/** KNIHOVNA UKÁZEK - seznam a zápis nové (11. 10. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  druh: z.enum([SEKCE.reference, SEKCE.herec]),
  nazev: z.string().trim().min(1).max(200),
  popis: z.string().trim().max(1000).optional(),
  herecId: z.string().trim().max(64).optional(),
  stitky: z.string().trim().max(300).optional(),
  klic: z.string().trim().min(1).max(500),
  nazevSouboru: z.string().trim().min(1).max(255),
  typSouboru: z.string().trim().max(160),
  delka: z.number().min(0).max(60 * 60 * 4).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  return NextResponse.json({ ukazky: await nactiKnihovnu(true) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  if (!TYPY_UKAZEK.includes(parsed.data.typSouboru)) {
    return NextResponse.json({ error: 'Tenhle typ souboru jako ukázku nebereme.' }, { status: 400 });
  }

  /**
   * Velikost si nebereme od prohlížeče - ten hlásí, co chce. Ptáme se
   * úložiště, jestli tam soubor opravdu leží a kolik váží; zároveň to
   * odchytí nahrání, které se v půlce rozpadlo.
   */
  const v = await overPrilohu(parsed.data.klic);
  if (!v) return NextResponse.json({ error: 'Soubor se do úložiště nenahrál.' }, { status: 400 });
  if (v.size > MAX_UKAZKA_BYTES) {
    return NextResponse.json({ error: 'Soubor je na ukázku moc velký.' }, { status: 400 });
  }

  const ukazka = await zalozUkazku({
    druh: parsed.data.druh,
    nazev: parsed.data.nazev,
    popis: parsed.data.popis ?? null,
    herecId: parsed.data.herecId ?? null,
    klic: parsed.data.klic,
    nazevSouboru: parsed.data.nazevSouboru,
    typSouboru: parsed.data.typSouboru,
    velikost: v.size,
    delka: parsed.data.delka ?? 0,
    stitky: parsed.data.stitky ?? '',
    nahralId: session.user.id,
  });
  if (!ukazka) return NextResponse.json({ error: 'Ukázku se nepodařilo uložit.' }, { status: 500 });

  return NextResponse.json({ ukazka });
}
