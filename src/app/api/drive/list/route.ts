import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId, getAccessToken, isWithinRoot, listFolder } from '@/lib/googleDrive';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.companyId) {
    return NextResponse.json({ error: 'Nejste přihlášen k žádné firmě.' }, { status: 401 });
  }

  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  const rootId = company?.driveFolderUrl ? extractDriveFolderId(company.driveFolderUrl) : null;
  if (!rootId) {
    return NextResponse.json({ error: 'Firmě není přiřazena složka na Google Disku.' }, { status: 404 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Napojení na Google Disk zatím není nastavené.' }, { status: 503 });
  }

  const requestedId = req.nextUrl.searchParams.get('folderId') || rootId;

  if (requestedId !== rootId) {
    const allowed = await isWithinRoot(requestedId, rootId, token);
    if (!allowed) {
      return NextResponse.json({ error: 'K této složce nemáte přístup.' }, { status: 403 });
    }
  }

  try {
    const items = await listFolder(requestedId, token);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('Načtení obsahu Google Disku selhalo:', err);
    return NextResponse.json({ error: 'Obsah složky se nepodařilo načíst.' }, { status: 502 });
  }
}
