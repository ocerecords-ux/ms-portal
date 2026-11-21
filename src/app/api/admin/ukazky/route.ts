import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { MAX_UKAZKA_BYTES, SEKCE, TYPY_UKAZEK } from '@/lib/prezentaceNabidky';
import { nactiKnihovnu, zalozUkazku } from '@/lib/ukazkyServer';
import { overPrilohu } from '@/lib/storage';
import { odpovedChyby } from '@/lib/chybyApi';

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
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  return NextResponse.json({ ukazky: await nactiKnihovnu(true) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Věta od `zod` jde první, a když žádná není, jde klíč (vzor z dávky 7s).
    return parsed.error.issues[0]?.message
      ? NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
      : odpovedChyby('chybaApi.neplatnaData', 400);
  }
  if (!TYPY_UKAZEK.includes(parsed.data.typSouboru)) {
    return odpovedChyby('chybaApi.ukazkaTypNebereme', 400);
  }

  /**
   * Velikost si nebereme od prohlížeče - ten hlásí, co chce. Ptáme se
   * úložiště, jestli tam soubor opravdu leží a kolik váží; zároveň to
   * odchytí nahrání, které se v půlce rozpadlo.
   */
  const v = await overPrilohu(parsed.data.klic);
  if (!v) return odpovedChyby('chybaApi.ukazkaNenahrana', 400);
  if (v.size > MAX_UKAZKA_BYTES) {
    return odpovedChyby('chybaApi.ukazkaMocVelka', 400);
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
  if (!ukazka) return odpovedChyby('chybaApi.ukazkaNeulozena', 500);

  return NextResponse.json({ ukazka });
}
