import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { DRUHY_NOTIFIKACI, stavySNotifikaci, type DruhNotifikace } from '@/lib/notifikaceFirmy';
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
  // Druh zpravy (zadani 14. 9. 2026). Kdo ho neposle, mysli audioknihy -
  // tak to bylo do te doby.
  druh: z.enum(['AUDIOKNIHA', 'REKLAMA']).optional(),
  stav: z.string().trim().min(1),
  predmet: z.string().trim().max(200),
  nadpis: z.string().trim().max(200),
  text: z.string().trim().min(1, 'Text zprávy nesmí být prázdný.').max(4000),
  // Tlacitko na AudioTagger (zadani 14. 9. 2026).
  audiotagger: z.boolean().optional(),
});

/** „REKLAMA" z adresy; cokoliv jineho znamena audioknihy. */
function druhZDotazu(hodnota: string | null): DruhNotifikace {
  return DRUHY_NOTIFIKACI.includes(hodnota as DruhNotifikace) ? (hodnota as DruhNotifikace) : 'AUDIOKNIHA';
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const druh = druhZDotazu(req.nextUrl.searchParams.get('druh'));
  return NextResponse.json({ druh, vzory: await nactiVzory(druh) });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { stav, druh: druhZTela, audiotagger, ...zbytek } = parsed.data;
  const druh: DruhNotifikace = druhZTela ?? 'AUDIOKNIHA';
  const vzor = { ...zbytek, audiotagger: audiotagger ?? false };
  if (!stavySNotifikaci(druh).includes(stav)) {
    return NextResponse.json({ error: `Ke stavu „${stav}" se zpráva neposílá.` }, { status: 400 });
  }

  await ulozVzor(stav, vzor, session.user.name || session.user.email || null, druh);
  return NextResponse.json({ druh, vzory: await nactiVzory(druh) });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const stav = req.nextUrl.searchParams.get('stav');
  if (!stav) return NextResponse.json({ error: 'Chybí stav.' }, { status: 400 });
  const druh = druhZDotazu(req.nextUrl.searchParams.get('druh'));
  await obnovVychozi(stav, druh);
  return NextResponse.json({ druh, vzory: await nactiVzory(druh) });
}
