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

  // Soubory vytvorene primo na Disku (Google Dokumenty/Tabulky/Prezentace)
  // nejdou stahnout pres alt=media - Google pro ne vyzaduje /export s
  // cilovym mime typem. Normalni nahrane soubory (mp3, wav, zip...) pouzivaji
  // bezny alt=media.
  const exportMimeByGoogleType: Record<string, string> = {
    'application/vnd.google-apps.document': 'application/pdf',
    'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  const exportMime = exportMimeByGoogleType[meta.mimeType];

  const driveUrl = exportMime
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

  // Prehravac (<audio>) potrebuje umet "skakat" v nahravce - k tomu je nutne
  // predat dal pozadavek na Range a vratit spravny 206/Content-Range. Export
  // (Google Dokumenty apod.) Range nepodporuje, tam se neposila.
  const rangeHeader = req.headers.get('range');

  const driveRes = await fetch(driveUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rangeHeader && !exportMime ? { Range: rangeHeader } : {}),
    },
  });
  if (!driveRes.ok || !driveRes.body) {
    console.error(
      'Stažení souboru selhalo:',
      driveRes.status,
      await driveRes.text().catch(() => ''),
    );
    return NextResponse.json({ error: 'Stažení souboru selhalo.' }, { status: 502 });
  }

  // Tlacitko "Stahnout" chce vynutit ulozeni (attachment), prehravac chce
  // soubor prehrat primo v prohlizeci (inline) - rozlisuje se parametrem.
  const forceInline = req.nextUrl.searchParams.get('disposition') === 'inline';

  // Disk casto vraci nazvy v NFD tvaru (napr. "Š" jako "S" + samostatny hacek),
  // coz po zakodovani do hlavicky vypadalo jako necitelne %CC%8C apod. -
  // normalizace na NFC to spoji zpet na jeden bezny znak. Zaroven pouzivame
  // jak "filename" (bezpecne ASCII, pro stare prohlizece), tak "filename*"
  // (spravne UTF-8 s diakritikou dle RFC 5987/6266) - tak se jmeno stazeneho
  // souboru zobrazi presne tak, jak je na Disku.
  const safeName = meta.name.normalize('NFC');
  const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");

  const headers: Record<string, string> = {
    'Content-Type': exportMime || meta.mimeType || 'application/octet-stream',
    'Content-Disposition': `${forceInline ? 'inline' : 'attachment'}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
  };
  const contentRange = driveRes.headers.get('content-range');
  const contentLength = driveRes.headers.get('content-length');
  const acceptRanges = driveRes.headers.get('accept-ranges');
  if (contentRange) headers['Content-Range'] = contentRange;
  if (contentLength) headers['Content-Length'] = contentLength;
  if (acceptRanges) headers['Accept-Ranges'] = acceptRanges;

  return new NextResponse(driveRes.body, {
    status: driveRes.status,
    headers,
  });
}
