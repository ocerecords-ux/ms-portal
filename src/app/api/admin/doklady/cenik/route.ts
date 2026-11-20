import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cenikProDoklady } from '@/lib/cenikProDokladServer';

/**
 * Ceník k vložení do dokladu (zadání 19. 11. 2026). Jen čtení - tentýž
 * ceník, jaký je v menu Ceníky.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  return NextResponse.json({ polozky: await cenikProDoklady() });
}
