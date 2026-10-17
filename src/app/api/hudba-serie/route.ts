import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { nactiHudbuSerie, zapisSkladbuSerie } from '@/lib/hudbaSerieServer';
import { isInternalRole } from '@/lib/roles';
import { overPrilohu } from '@/lib/storage';

/**
 * HUDBA CELÉ SÉRIE (zadání 17. 10. 2026). Spravuje se na stránce Hudba
 * k audioknihám; odtud se kopíruje do každého nového dílu.
 *
 * Tady NEJDE SOUBOR, jen záznam o něm - samotný WAV putuje z prohlížeče rovnou
 * do Dropboxu (viz podpis/route.ts).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  serie: z.string().trim().min(1).max(200),
  companyId: z.string().trim().max(60).nullable().optional(),
  cesta: z.string().trim().min(1),
  nazev: z.string().trim().max(200),
  autor: z.string().trim().max(200).nullable().optional(),
  delkaS: z.number().int().min(0).max(24 * 3600).optional(),
  obalKlic: z.string().trim().max(300).nullable().optional(),
  poznamka: z.string().trim().max(500).optional(),
});

async function straz() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const serie = req.nextUrl.searchParams.get('serie') ?? '';
  const companyId = req.nextUrl.searchParams.get('companyId') || null;
  return NextResponse.json({ hudba: await nactiHudbuSerie(serie, companyId) });
}

export async function POST(req: NextRequest) {
  const session = await straz();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  // Klíč obalu přišel z prohlížeče - bez ověření by v kartě visel odkaz na
  // obrázek, který v úložišti není.
  const obalKlic = parsed.data.obalKlic?.trim() || null;
  const obalOvereny = obalKlic && (await overPrilohu(obalKlic)) ? obalKlic : null;

  const skladba = await zapisSkladbuSerie({
    serie: parsed.data.serie,
    companyId: parsed.data.companyId ?? null,
    cesta: parsed.data.cesta,
    nazev: parsed.data.nazev,
    autor: parsed.data.autor ?? null,
    delkaS: parsed.data.delkaS ?? 0,
    obalKlic: obalOvereny,
    poznamka: parsed.data.poznamka ?? null,
    pridalId: session.user.id,
  });

  if (!skladba) {
    return NextResponse.json(
      { error: 'Soubor se v Dropboxu nenašel. Zkuste nahrát znovu.' },
      { status: 502 },
    );
  }
  return NextResponse.json({ skladba }, { status: 201 });
}
