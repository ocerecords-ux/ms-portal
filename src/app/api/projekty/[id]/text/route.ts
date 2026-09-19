import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { getAccessToken } from '@/lib/googleDrive';
import { nactiZDisku } from '@/lib/preposlechDriveServer';

/**
 * TEXT PROJEKTU PRO HERCE (zadání 19. 9. 2026: „v projektech by měl herec
 * vidět… link na text").
 *
 * Text je stejné PDF, ze kterého čte AudioTagger - ve složce projektu na
 * Disku, název končí `_RE` (režijní edit), viz lib/preposlechDriveServer.ts.
 * Herec do složky na Disku přístup nemá, proto se PDF vydává přes portál:
 * jen tomu, kdo je u projektu vedený jako herec (nebo týmu).
 */
export const dynamic = 'force-dynamic';

function hlaska(text: string, status: number) {
  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Text projektu</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#222"><h1 style="font-size:1.25rem">Text zatím není k dispozici</h1><p>${text}</p><p>Kdyby vám chyběl, napište nám do chatu.</p></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return hlaska('Nejdřív se přihlaste do portálu.', 401);

  if (!isInternalRole(session.user.role)) {
    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: params.id },
      select: { actorUserId: true, herci: { select: { id: true } } },
    });
    const jeHerec =
      !!meta && (meta.actorUserId === session.user.id || meta.herci.some((h) => h.id === session.user.id));
    if (!jeHerec) return hlaska('K tomuto projektu nemáte přístup.', 403);
  }

  const obsah = await nactiZDisku(params.id);
  if (!obsah.ok) return hlaska('Text k projektu jsme ještě nenahráli.', 404);
  if (!obsah.text) return hlaska('Text k projektu jsme ještě nenahráli.', 404);

  const token = await getAccessToken();
  if (!token) return hlaska('Text se teď nepodařilo načíst, zkuste to za chvíli.', 503);

  const odpoved = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(obsah.text.id)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!odpoved.ok || !odpoved.body) {
    console.error('Vydej textu projektu selhal:', odpoved.status);
    return hlaska('Text se teď nepodařilo načíst, zkuste to za chvíli.', 502);
  }

  const hlavicky = new Headers();
  hlavicky.set('Content-Type', 'application/pdf');
  const delka = odpoved.headers.get('content-length');
  if (delka) hlavicky.set('Content-Length', delka);
  hlavicky.set('Cache-Control', 'private, max-age=600');
  // Otevre se v prohlizeci, s ?stahnout=1 se rovnou stahne (zadani
  // 19. 9. 2026: „text by mel jit i stahnout"). Nazev zustava puvodni.
  const stahnout = req.nextUrl.searchParams.get('stahnout') === '1';
  hlavicky.set(
    'Content-Disposition',
    `${stahnout ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(obsah.text.name)}`,
  );
  return new NextResponse(odpoved.body, { status: 200, headers: hlavicky });
}
