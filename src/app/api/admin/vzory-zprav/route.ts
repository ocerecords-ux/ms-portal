import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { STAVY_S_NOTIFIKACI } from '@/lib/notifikaceFirmy';
import { nactiVzory, obnovVychozi, ulozVzor } from '@/lib/vzoryZpravServer';

/**
 * Vzory zpráv klientovi (zadání 11. 9. 2026). Jen Žůžo-labůžo: je to znění,
 * které jde ven pod hlavičkou Mediaspace.
 *
 * `DELETE ?stav=...` neznamená smazat zprávu, ale vrátit se k výchozímu
 * znění — řádek v databázi existuje jen pro upravený stav.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  stav: z.string().trim().min(1),
  predmet: z.string().trim().max(200),
  nadpis: z.string().trim().max(200),
  text: z.string().trim().min(1, 'Text zprávy nesmí být prázdný.').max(4000),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  return NextResponse.json({ vzory: await nactiVzory() });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { stav, ...vzor } = parsed.data;
  if (!STAVY_S_NOTIFIKACI.includes(stav)) {
    return NextResponse.json({ error: `Ke stavu „${stav}" se zpráva neposílá.` }, { status: 400 });
  }

  await ulozVzor(stav, vzor, session.user.name || session.user.email || null);
  return NextResponse.json({ vzory: await nactiVzory() });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const stav = req.nextUrl.searchParams.get('stav');
  if (!stav) return NextResponse.json({ error: 'Chybí stav.' }, { status: 400 });
  await obnovVychozi(stav);
  return NextResponse.json({ vzory: await nactiVzory() });
}
