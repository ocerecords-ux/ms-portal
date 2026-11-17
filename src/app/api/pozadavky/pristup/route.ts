import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { pristupKPozadavkum, smiNaSeznam } from '@/lib/pozadavkyStudii';

/**
 * Má se tomuhle člověku vůbec ukázat záložka „Co je potřeba" v chatu?
 *
 * Samostatná mikro-routa schválně: ChatDock se renderuje na třech místech
 * (portál, administrace, mobilní stránka chatu) a předávat právo propem by
 * znamenalo tahat ho do všech tří layoutů. Odpověď je jeden boolean.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !isInternalRole(session.user.role)) {
      return NextResponse.json({ smi: false });
    }
    const pristup = await pristupKPozadavkum(session.user.id, session.user.role);
    return NextResponse.json({ smi: smiNaSeznam(pristup) });
  } catch (err) {
    console.error('GET /api/pozadavky/pristup selhalo:', err);
    return NextResponse.json({ smi: false });
  }
}
