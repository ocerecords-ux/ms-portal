import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { smiNaPalubovku, ulozCile } from '@/lib/palubovkaServer';

/**
 * CÍLE PALUBOVKY (zadání 27. 9. 2026: „zadám si vlastní cíle").
 *
 * Mění je jen ten, kdo na palubovku vidí - jsou to jeho čísla a nikoho
 * dalšího se netýkají.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  mesicniObrat: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  rocniObrat: z.number().int().min(0).max(10_000_000_000).nullable().optional(),
  mesicuKryti: z.number().min(0.5).max(12).optional(),
  // Cíl čistého zisku z uzavřených audioknih za měsíc (28. 9. 2026).
  mesicniZiskKnih: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!(await smiNaPalubovku())) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Zadejte cíle jako čísla.' }, { status: 400 });
  }
  const cile = await ulozCile({
    mesicniObrat: parsed.data.mesicniObrat ?? null,
    rocniObrat: parsed.data.rocniObrat ?? null,
    mesicuKryti: parsed.data.mesicuKryti ?? 2,
    mesicniZiskKnih: parsed.data.mesicniZiskKnih ?? null,
  });
  return NextResponse.json({ cile });
}
