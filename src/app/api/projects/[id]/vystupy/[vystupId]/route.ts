import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { nactiVystup, smazVystup, upravVystup } from '@/lib/vystupyServer';

/**
 * ÚPRAVA A SMAZÁNÍ JEDNOHO VÝSTUPU (zadání 26. 9. 2026).
 *
 * Posílá se jen to, co se mění - pole, které v požadavku není, zůstane, jak
 * bylo. Stejné pravidlo jako u /api/projects/[id]/meta: na detailu projektu je
 * formulářů víc a jeden nesmí přemazat pole druhého.
 *
 * Prázdný řetězec je u textových polí „smazat", u seznamů (herci, licence)
 * prázdné pole znamená „nikdo", ne „neměň" - proto se posílají celé.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().max(200).optional(),
  typKlic: z.string().trim().max(200).nullable().optional(),
  delkaSekund: z.number().int().positive().max(36000).nullable().optional(),
  sluzby: z.array(z.string().trim().min(1)).max(10).optional(),
  herciIds: z.array(z.string().trim().min(1)).max(20).optional(),
  rezie: z.string().trim().max(200).nullable().optional(),
  hudbaNazev: z.string().trim().max(300).nullable().optional(),
  hudbaAutor: z.string().trim().max(300).nullable().optional(),
  bezHudby: z.boolean().optional(),
  datumVyroby: z.string().trim().max(10).nullable().optional(),
  klientNaRL: z.string().trim().max(300).nullable().optional(),
  licenceIds: z.array(z.string().trim().min(1)).max(20).optional(),
  licenceUziti: z.string().trim().max(300).nullable().optional(),
  licenceOd: z.string().trim().max(10).nullable().optional(),
  licenceMesicu: z.number().int().positive().max(1200).nullable().optional(),
  hotovo: z.boolean().optional(),
  potvrzeno: z.boolean().optional(),
});

/** Výstup musí patřit projektu z adresy - ID z těla se nevěří. */
async function overVystup(vystupId: string, caflouProjectId: string) {
  const nalezeny = await nactiVystup(vystupId);
  if (!nalezeny || nalezeny.caflouProjectId !== caflouProjectId) return null;
  return nalezeny;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vystupId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, vystupId } = await params;
  if (!(await overVystup(vystupId, id))) {
    return NextResponse.json({ error: 'Výstup nenalezen.' }, { status: 404 });
  }

  const telo = await req.json().catch(() => null);
  const data = schema.safeParse(telo);
  if (!data.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const vystup = await upravVystup(vystupId, data.data);
  if (!vystup) return NextResponse.json({ error: 'Výstup se nepodařilo uložit.' }, { status: 500 });

  return NextResponse.json({ vystup });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vystupId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, vystupId } = await params;
  if (!(await overVystup(vystupId, id))) {
    return NextResponse.json({ error: 'Výstup nenalezen.' }, { status: 404 });
  }

  const vysledek = await smazVystup(vystupId);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.duvod }, { status: 409 });

  return NextResponse.json({ ok: true });
}
