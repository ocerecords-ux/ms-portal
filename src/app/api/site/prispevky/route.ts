import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { nactiPrispevky, smiSite, zalozPrispevek } from '@/lib/socialniServer';
import type { Platno } from '@/lib/socialni';

/** Příspěvky na sítě - seznam a zakládání (zadání 27. 9. 2026). */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().max(200).optional(),
  format: z.string().trim().max(40),
  platno: z.unknown().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  return NextResponse.json({ prispevky: await nactiPrispevky(session.user.id) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(await smiSite(session.user.id))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const prispevek = await zalozPrispevek(session.user.id, {
    nazev: parsed.data.nazev ?? 'Nový příspěvek',
    format: parsed.data.format,
    platno: parsed.data.platno as Platno | undefined,
  });
  return NextResponse.json({ prispevek });
}
