import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta, isInternalRole } from '@/lib/roles';
import { presunDoKoseNaDisku } from '@/lib/googleDrive';

/**
 * Výdej a mazání licenčního listu (zadání 22. 9. 2026) - stejná pravidla jako
 * u Rodného listu: klient jen listy své firmy, tým Mediaspace všechny.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const ll = await prisma.licencniList.findUnique({ where: { id: params.id } });
  if (!ll) return NextResponse.json({ error: 'Licenční list nenalezen.' }, { status: 404 });

  const jeJehoFirma = Boolean(ll.companyId) && ll.companyId === session.user.companyId;
  if (!isInternalRole(session.user.role) && !jeJehoFirma) {
    return NextResponse.json({ error: 'K tomuto dokumentu nemáte přístup.' }, { status: 403 });
  }

  if (!ll.url.startsWith('data:')) return NextResponse.redirect(ll.url);
  const bytes = Buffer.from(ll.url.slice(ll.url.indexOf(',') + 1), 'base64');
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ll.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isInternalRole(session.user.role) || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Na mazání licenčních listů nemáte právo.' }, { status: 403 });
  }
  const ll = await prisma.licencniList.findUnique({ where: { id: params.id }, select: { id: true, driveFileId: true } });
  if (!ll) return NextResponse.json({ error: 'Licenční list nenalezen.' }, { status: 404 });
  // Kopie na Disku jde do koše, ne natrvalo.
  if (ll.driveFileId) await presunDoKoseNaDisku(ll.driveFileId).catch(() => false);
  await prisma.licencniList.delete({ where: { id: ll.id } });
  return NextResponse.json({ ok: true });
}
