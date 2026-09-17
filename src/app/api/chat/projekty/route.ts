import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadInternalProjects } from '@/lib/projektySeznamServer';
import { canUseChat } from '@/lib/chatServer';
import { vidiProjektyVPriprave } from '@/lib/roles';
import { jeVPriprave } from '@/lib/stavyProjektu';

// Rozpracovane projekty pro zalozku "Projekty" v chatu (zadani 8. 9. 2026).
// Nacita se az na vyzadani, kdyz si nekdo zalozku otevre - v layoutu by to
// znamenalo dotaz navic pri kazdem zobrazeni jakekoliv stranky.
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  try {
    const { projects, error } = await loadInternalProjects();
    if (error) return NextResponse.json({ projekty: [], chyba: error });

    /**
     * PROJEKT V PŘÍPRAVĚ ZVUKAŘ NEVIDÍ ANI TADY (zadání 17. 9. 2026: kanál
     * „nevidí jen v přípravě zvukaři").
     *
     * Kanály samotné se zvukaři neukazují už v lib/chatServer.ts. Tenhle
     * seznam ale stojí na projektech, ne na kanálech - bez tohohle by se mu
     * projekt v přípravě objevil v záložce Projekty jako kanál k založení,
     * tedy přesně to, čemu se to pravidlo vyhýbá.
     */
    const vidiVPriprave = vidiProjektyVPriprave(session.user.role);

    const projekty = projects
      .filter((p) => !p.finished)
      .filter((p) => vidiVPriprave || !jeVPriprave(p.statusName))
      // Jen nazev projektu, bez firmy (zadani 8. 9. 2026: "musi tam byt
      // nazvy projektu jen, ne firem, jinak to bude dlouhe").
      .map((p) => ({ id: String(p.id), label: p.name, name: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs'));

    return NextResponse.json({ projekty, chyba: null });
  } catch (err) {
    console.error('GET /api/chat/projekty selhalo:', err);
    return NextResponse.json({ projekty: [], chyba: 'Projekty se nepodařilo načíst.' });
  }
}
