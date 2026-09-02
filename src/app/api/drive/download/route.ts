import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId, getAccessToken, getFileMeta, isWithinRoot } from '@/lib/googleDrive';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.companyId) {
    return NextResponse.json({ error: 'Nejste přihlášen k žádné firmě.' }, { status: 401 });
  }

  const fileId = req.nextUrl.searchParams.get('fileId');
  if (!fileId) {
    return NextResponse.json({ error: 'Chybí ID souboru.' }, { status: 400 });
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

  const allowed = fileId === rootId || (await isWithinRoot(fileId, rootId, token));
  if (!allowed) {
    return NextResponse.json({ error: 'K tomuto souboru nemáte přístup.' }, { status: 403 });
  }

  const meta = await getFileMeta(fileId, token);
  if (!meta) {
    return NextResponse.json({ error: 'Soubor nenalezen.' }, { status: 404 });
  }

  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!driveRes.ok || !driveRes.body) {
    return NextResponse.json({ error: 'Stažení souboru selhalo.' }, { status: 502 });
  }

  return new NextResponse(driveRes.body, {
    headers: {
      'Content-Type': meta.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.name)}"`,
    },
  });
}
