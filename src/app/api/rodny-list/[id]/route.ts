import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

/**
 * Výdej hotového Rodného listu (PDF) - zadání 9. 9. 2026.
 *
 * DŮLEŽITÉ - tenant izolace: klient smí otevřít jen RL své firmy. Firma se
 * bere VÝHRADNĚ ze session (session.user.companyId), nikdy z parametru, aby
 * si nikdo cizí dokument nevytáhl uhodnutím ID. Interní účty Mediaspace
 * (Žůžo-labůžo / Produkce / Zvukař) vidí všechny.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  }

  const rl = await prisma.rodnyList.findUnique({ where: { id: params.id } });
  if (!rl) {
    return NextResponse.json({ error: 'Rodný list nenalezen.' }, { status: 404 });
  }

  const jeInterni = isInternalRole(session.user.role);
  const jeJehoFirma = Boolean(rl.companyId) && rl.companyId === session.user.companyId;
  if (!jeInterni && !jeJehoFirma) {
    return NextResponse.json({ error: 'K tomuto dokumentu nemáte přístup.' }, { status: 403 });
  }

  // Když je nastavené úložiště souborů (S3/R2), PDF tam leží pod náhodným
  // klíčem - jen na něj přesměrujeme. Bez úložiště je dokument uložený rovnou
  // v databázi jako data URL a posíláme ho odsud.
  if (!rl.url.startsWith('data:')) {
    return NextResponse.redirect(rl.url);
  }

  const base64 = rl.url.slice(rl.url.indexOf(',') + 1);
  const bytes = Buffer.from(base64, 'base64');

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      // inline = otevře se rovnou v prohlížeči, stáhnout jde pořád.
      'Content-Disposition': `inline; filename="${rl.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
