import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { smiSchvalovatPribehy } from '@/lib/pribehyServer';
import { smazSkladbu, upravSkladbu } from '@/lib/hudbaServer';

/** Přejmenování, vypnutí a smazání skladby - všechno jen pro produkci. */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(160).optional(),
  autor: z.string().trim().max(160).optional(),
  aktivni: z.boolean().optional(),
});

async function smi() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  return smiSchvalovatPribehy({ id: session.user.id, role: session.user.role });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await smi())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const skladba = await upravSkladbu(params.id, parsed.data);
  if (!skladba) return NextResponse.json({ error: 'Není co měnit.' }, { status: 400 });
  return NextResponse.json({ skladba });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await smi())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (!(await smazSkladbu(params.id))) {
    return NextResponse.json({ error: 'Smazat se nepodařilo.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
