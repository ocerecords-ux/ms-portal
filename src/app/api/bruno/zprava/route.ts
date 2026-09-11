import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canUseChat } from '@/lib/chatServer';
import { brunoZpracujZpravu, jeBrunoNastaveny } from '@/lib/brunoServer';

/**
 * Probuzení Bruna nad čerstvou zprávou (zadání 12. 9. 2026).
 *
 * PROČ TO NENÍ ROVNOU V ODESLÁNÍ ZPRÁVY: Bruno se ptá modelu a to trvá vteřiny.
 * Kdyby na něj čekalo odeslání zprávy, psalo by se v chatu jako přes bahno.
 * Zpráva se proto uloží a odpoví hned; Bruna zavolá prohlížeč hned potom
 * a na nic nečeká. Když tenhle dotaz selže nebo ho člověk zavřením okna
 * přeruší, nestane se nic horšího, než že Bruno tu jednu zprávu minul.
 *
 * Kdo smí: kdokoliv z týmu, kdo smí do chatu. Samotný obsah si Bruno načte
 * z databáze podle ID zprávy, takže odsud nejde podstrčit nic vymyšleného.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({ messageId: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  if (!jeBrunoNastaveny()) return NextResponse.json({ bruno: 'vypnuto' });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  await brunoZpracujZpravu(parsed.data.messageId);
  return NextResponse.json({ bruno: 'hotovo' });
}
