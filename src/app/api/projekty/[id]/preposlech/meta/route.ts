import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { pristupKPreposlechu } from '@/lib/preposlechPristup';
import { ulozMetaStopy } from '@/lib/stopaMetaServer';

/**
 * ULOŽENÍ SPOČÍTANÉ KŘIVKY A DÉLKY (23. 11. 2026). Prohlížeč to spočítá
 * jednou a pošle sem; další už si to jen přečtou se seznamem stop.
 *
 * Smí sem každý, kdo má přístup k přeposlechu - klient z odkazu i náš tým.
 * Není co zneužít: ukládá se jen obrázek hlasitosti a délka souboru, který
 * ten člověk stejně právě poslouchá.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({
  souborId: z.string().trim().min(1).max(200),
  velikost: z.number().int().positive().nullable().optional(),
  delka: z.number().positive().max(24 * 3600).nullable().optional(),
  /** Dvojice [min, max] na sloupec; víc než tisíc sloupců nekreslíme. */
  peaks: z
    .array(z.tuple([z.number(), z.number()]))
    .max(2000)
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await pristupKPreposlechu(params.id, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) return NextResponse.json({ error: pristup.message }, { status: pristup.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  await ulozMetaStopy({
    souborId: parsed.data.souborId,
    velikost: parsed.data.velikost ?? null,
    delka: parsed.data.delka ?? null,
    peaks: parsed.data.peaks ?? null,
  });
  return NextResponse.json({ ok: true });
}
