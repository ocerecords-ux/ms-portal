import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getFolderInfo, isWithinRoot, listFolder } from '@/lib/googleDrive';
import { korenProZadost } from '@/lib/drivePristup';

export async function GET(req: NextRequest) {
  // Prihlaseny klient, nebo token z mailu - viz lib/drivePristup.ts.
  const koren = await korenProZadost(req);
  if ('chyba' in koren) {
    return NextResponse.json({ error: koren.chyba }, { status: koren.status });
  }
  const rootId = koren.rootId;

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
    // Vedle obsahu vracime i udaje o samotne slozce - sekce Nahravky z toho
    // dela tlacitko "odkaz na celou složku" (zadani 5. 9. 2026).
    const [items, folder] = await Promise.all([listFolder(requestedId, token), getFolderInfo(requestedId, token)]);
    return NextResponse.json({ items, folder });
  } catch (err) {
    console.error('Načtení obsahu Google Disku selhalo:', err);
    return NextResponse.json({ error: 'Obsah složky se nepodařilo načíst.' }, { status: 502 });
  }
}
