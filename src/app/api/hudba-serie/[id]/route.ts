import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import {
  odkazNaSkladbuSerie,
  odpojSkladbuSerie,
  upravPoznamkuSerie,
} from '@/lib/hudbaSerieServer';
import { isInternalRole } from '@/lib/roles';

/**
 * JEDNA SKLADBA SÉRIE (17. 10. 2026).
 *
 * GET    - adresa na přehrání, platí čtyři hodiny
 * PATCH  - jen poznámka; název a autor jsou z metadat souboru
 * DELETE - odebere skladbu z PŘEDLOHY série. Dílům, které ji už dostaly,
 *          nic nebere - mají vlastní záznamy.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ poznamka: z.string().trim().max(500).nullable() });

async function straz() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const { id } = await params;
  const odkaz = await odkazNaSkladbuSerie(id);
  if (!odkaz) return NextResponse.json({ error: 'Soubor se nepodařilo otevřít.' }, { status: 502 });
  return NextResponse.json({ odkaz });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const { id } = await params;
  const ok = await upravPoznamkuSerie(id, parsed.data.poznamka);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const { id } = await params;
  const ok = await odpojSkladbuSerie(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
