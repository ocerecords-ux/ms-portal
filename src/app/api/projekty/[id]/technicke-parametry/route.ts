import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { parametryProjektu } from '@/lib/technickeParametryServer';

/**
 * TECHNICKÉ PARAMETRY JEDNOHO PROJEKTU (zadání 27. 9. 2026: „v kanálu projektu
 * v chatu pod nějakou ikonkou, na kterou když kliknou, tak to bude jak proklik
 * na přeposlech. Vyskakovací okno").
 *
 * Kartu v projektu skládá server rovnou do stránky; tohle je pro chat, kde se
 * okno otevírá až kliknutím - do doku se nemá smysl posílat parametry všech
 * projektů dopředu.
 *
 * Jen pro náš tým. Klient technické parametry výroby nepotřebuje a herec taky
 * ne - je to instrukce pro toho, kdo knihu natáčí a stříhá.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const parametry = await parametryProjektu(params.id);
  return NextResponse.json({ parametry });
}
