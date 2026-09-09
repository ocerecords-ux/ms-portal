import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canUseChat } from '@/lib/chatServer';
import { MAX_PRILOHA_BYTES } from '@/lib/chatPrilohy';
import { isStorageConfigured, podepsanyUploadPrilohy } from '@/lib/storage';

/**
 * Adresa, na kterou prohlížeč pošle přílohu do chatu (zadání 9. 9. 2026).
 *
 * Soubor NEJDE přes portál - funkce na Vercelu mají strop na velikost
 * požadavku kolem 4,5 MB a Mediaspace posílá zvukové soubory a fotky, které
 * jsou běžně větší. Prohlížeč si tu vyžádá podepsanou adresu a nahraje soubor
 * rovnou do úložiště; portál pak u zprávy jen ověří, že tam soubor opravdu
 * leží (viz overPrilohu).
 *
 * Klíč si určuje výhradně server. Kdyby ho posílal prohlížeč, dal by se jím
 * přepsat cizí soubor v úložišti.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(160).optional(),
  size: z.number().int().positive().max(MAX_PRILOHA_BYTES, 'Příloha je moc velká.'),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  if (!isStorageConfigured()) {
    // Radši rovnou a nahlas, než aby soubor tiše zmizel - přesně to se dodnes
    // děje u příloh objednávek.
    return NextResponse.json(
      { error: 'Přílohy zatím nejdou - portál nemá nastavené úložiště souborů.' },
      { status: 503 },
    );
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Neplatná příloha.' },
        { status: 400 },
      );
    }

    const podpis = await podepsanyUploadPrilohy(
      parsed.data.name,
      parsed.data.mime || 'application/octet-stream',
    );
    if (!podpis) {
      return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });
    }

    return NextResponse.json(podpis);
  } catch (err) {
    console.error('POST /api/chat/prilohy/podpis selhalo:', err);
    // Spravci ukazeme i duvod - nastaveni uloziste se ladi naslepo mizerne
    // a v teto hlasce zadne tajne hodnoty nejsou. Ostatnim jen obecne.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: 'Přílohu se nepodařilo připravit.',
        detail: session.user.role === 'ADMIN' ? detail : undefined,
      },
      { status: 500 },
    );
  }
}
