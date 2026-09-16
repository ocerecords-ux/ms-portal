import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canEditProjectMeta } from '@/lib/roles';
import { poslatKlientoviZnovu } from '@/lib/dotoceniServer';

/**
 * Poslat klientovi znovu zprávu o dotočeném herci (zadání 16. 9. 2026:
 * „a můžeme teď poslat Radce zpětně info o tom, že je dotočeno s Lubošem
 * Ondráčkem — Kubánské tango?").
 *
 * Když si klient upozornění zapne až potom, co se u jeho projektu dotočilo,
 * samo mu už nic nepřijde — fajfka se schválně neoznamuje dvakrát. Tohle je
 * to jedno místo, odkud se zpráva pošle dodatečně.
 *
 * NIC SE TÍM NEPŘEPISUJE: datum dotočení, stav projektu ani naše interní
 * zprávy zůstávají, jak jsou. Odejde jen ten jeden mail a zvoneček. Proto to
 * není odškrtnutí a znovuzaškrtnutí tlačítka, kterým by se to taky „dalo" —
 * tím by se přepsalo datum a produkci by mail přišel podruhé.
 *
 * Samotná práce (i kontrola, že ten herec dotočeno OPRAVDU má) je
 * v lib/dotoceniServer.ts.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ userId: z.string().trim().min(1) });

/** Proč se nic neposlalo — text pro člověka u tlačítka. */
const DUVODY: Record<string, string> = {
  'neznamy-projekt': 'Projekt nebo herec nenalezen.',
  'neni-dotoceno': 'Tenhle herec zatím dotočeno nemá.',
  'bez-klienta': 'Projekt nemá vyplněného klienta s účtem v portálu.',
  'nema-zapnuto': 'Klient tohle upozornění zapnuté nemá — zapíná se na jeho kartě uživatele.',
  reklama: 'U reklam se klientům o dotočení nepíše.',
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }

  const vysledek = await poslatKlientoviZnovu(params.id, parsed.data.userId);
  if (!vysledek.poslano) {
    return NextResponse.json(
      { error: DUVODY[vysledek.duvod] ?? 'Zprávu se nepodařilo poslat.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    zprava: `Odesláno: ${vysledek.jmenoKlienta} (mail i zvoneček).`,
  });
}
