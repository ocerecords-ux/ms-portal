import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { oznacHerceDotoceno, zrusHerceDotoceno } from '@/lib/dotoceniServer';

/**
 * Dotočený herec na projektu (zadání 11. 9. 2026: „u herců v projektech
 * v detailu vložit vedle jeho jména tlačítko Dotočeno… fajfku prosím
 * v přehledu i v detailu" + „info o dotočeno s hercem jde notifikací mailem
 * na Helenu Rychlík").
 *
 * Je to vlastnost DVOJICE projekt + herec: na audioknize bývá herců víc a
 * každý končí jindy.
 *
 * SAMOTNÁ PRÁCE JE V lib/dotoceniServer.ts (16. 9. 2026) — stejnou věc dělá
 * i Bruno, když někdo napíše „dotočeno" do kanálu projektu. Tady zůstala jen
 * práva a tvar odpovědi; co se přesně stane (fajfka, překlopení stavu, zpráva
 * Helče, mlčení u reklam) je popsané tam.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().trim().min(1),
  dotoceno: z.boolean(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { userId, dotoceno } = parsed.data;
  const kdo = { id: session.user.id, jmeno: session.user.name || session.user.email || null };

  if (!dotoceno) {
    const stav = await zrusHerceDotoceno(params.id, userId, kdo);
    return NextResponse.json({ dotoceno: false, stav });
  }

  const vysledek = await oznacHerceDotoceno(params.id, userId, kdo);
  if (!vysledek) return NextResponse.json({ error: 'Projekt nebo herec nenalezen.' }, { status: 404 });

  return NextResponse.json({
    dotoceno: true,
    dotocenoAt: vysledek.dotocenoAt,
    stav: vysledek.stav,
  });
}
