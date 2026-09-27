import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ocistiSekce } from '@/lib/technickeParametry';
import { smazProfil, smiSpravovatParametry, upravProfil } from '@/lib/technickeParametryServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(120).optional(),
  druh: z.enum(['AUDIOKNIHA', 'REKLAMA']).optional(),
  perex: z.string().trim().max(300).nullable().optional(),
  sekce: z.unknown().optional(),
  vychozi: z.boolean().optional(),
  aktivni: z.boolean().optional(),
  poradi: z.number().int().min(0).max(9999).optional(),
  firmyIds: z.array(z.string()).max(200).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await smiSpravovatParametry())) {
    return NextResponse.json({ error: 'Technické parametry smí měnit jen pověřený člověk.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const zmena = { ...parsed.data } as Record<string, unknown>;
  if (parsed.data.sekce !== undefined) zmena.sekce = ocistiSekce(parsed.data.sekce);

  const profil = await upravProfil(params.id, zmena);
  if (!profil) return NextResponse.json({ error: 'Sada nenalezena.' }, { status: 404 });
  return NextResponse.json({ profil });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await smiSpravovatParametry())) {
    return NextResponse.json({ error: 'Technické parametry smí měnit jen pověřený člověk.' }, { status: 403 });
  }
  await smazProfil(params.id);
  return NextResponse.json({ ok: true });
}
