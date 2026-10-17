import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { odkazNaSkladbu, odpojSkladbu, upravSkladbu } from '@/lib/hudbaProjektuServer';

/**
 * JEDNA SKLADBA (zadání 16. 10. 2026).
 *
 * GET    - adresa na přehrání, platí čtyři hodiny (vyrábí se až při kliknutí)
 * PATCH  - POZNÁMKA A OZNAČENÝ ÚSEK. Název a autor se čtou z metadat souboru
 *          a přepsat je by znamenalo, že v kartě svítí něco jiného než
 *          v souboru (zadání 17. 10. 2026: „ten název autor by neměl jít
 *          měnit"). Úsek je poznámka pro střih, soubor zůstává celý.
 * DELETE - ODPOJÍ skladbu od projektu. Soubor v Dropboxu zůstává; hudební
 *          knihovna je společná a jedno kliknutí nesmí vzít soubor projektům,
 *          které ho používají taky.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  poznamka: z.string().trim().max(500).nullable().optional(),
  usekOd: z.number().int().min(0).max(24 * 3600).nullable().optional(),
  usekDo: z.number().int().min(0).max(24 * 3600).nullable().optional(),
});

async function straz() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isInternalRole(session.user.role)) return null;
  return session;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ hudbaId: string }> }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const { hudbaId } = await params;
  const odkaz = await odkazNaSkladbu(hudbaId);
  if (!odkaz) return NextResponse.json({ error: 'Soubor se nepodařilo otevřít.' }, { status: 502 });
  return NextResponse.json({ odkaz });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ hudbaId: string }> }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const { hudbaId } = await params;
  const ok = await upravSkladbu(hudbaId, parsed.data);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ hudbaId: string }> }) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const { hudbaId } = await params;
  const ok = await odpojSkladbu(hudbaId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
