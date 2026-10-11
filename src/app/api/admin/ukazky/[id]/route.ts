import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { upravUkazku, vyradUkazku } from '@/lib/ukazkyServer';

/** Úprava a vyřazení ukázky z knihovny (11. 10. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(200).optional(),
  popis: z.string().trim().max(1000).nullable().optional(),
  stitky: z.string().trim().max(300).optional(),
  aktivni: z.boolean().optional(),
  poradi: z.number().int().min(-10_000).max(10_000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const ukazka = await upravUkazku(params.id, parsed.data);
  if (!ukazka) return NextResponse.json({ error: 'Ukázku se nepodařilo upravit.' }, { status: 500 });
  return NextResponse.json({ ukazka });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const ok = await vyradUkazku(params.id);
  if (!ok) return NextResponse.json({ error: 'Ukázku se nepodařilo vyřadit.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
