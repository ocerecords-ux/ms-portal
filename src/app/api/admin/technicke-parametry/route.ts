import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ocistiSekce } from '@/lib/technickeParametry';
import { nactiProfily, smiSpravovatParametry, zalozProfil } from '@/lib/technickeParametryServer';

/**
 * SPRÁVA SAD TECHNICKÝCH PARAMETRŮ (zadání 27. 9. 2026).
 *
 * Číst smí každý přihlášený z týmu (karta projektu je stejně ukazuje), měnit
 * jen ten, kdo má na účtu příznak - viz smiSpravovatParametry.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(120),
  druh: z.enum(['AUDIOKNIHA', 'REKLAMA']),
  perex: z.string().trim().max(300).optional(),
  sekce: z.unknown().optional(),
  vychozi: z.boolean().optional(),
  aktivni: z.boolean().optional(),
  poradi: z.number().int().min(0).max(9999).optional(),
  firmyIds: z.array(z.string()).max(200).optional(),
});

export async function GET() {
  return NextResponse.json({ profily: await nactiProfily() });
}

export async function POST(req: NextRequest) {
  if (!(await smiSpravovatParametry())) {
    return NextResponse.json({ error: 'Technické parametry smí měnit jen pověřený člověk.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Chybí název nebo druh.' }, { status: 400 });

  const profil = await zalozProfil({
    ...parsed.data,
    sekce: ocistiSekce(parsed.data.sekce),
  });
  return NextResponse.json({ profil });
}
