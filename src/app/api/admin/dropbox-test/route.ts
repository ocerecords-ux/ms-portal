import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';

/**
 * KONTROLKA NAPOJENÍ NA DROPBOX (16. 10. 2026).
 *
 * Když se token nepodaří obnovit, Dropbox hlásí jen „invalid_client: Invalid
 * client_id or client_secret" - a neřekne, která z těch dvou hodnot je
 * špatně. Tahle routa to pozná bez toho, aby kdokoliv musel klíče vidět:
 * ukáže jen JEJICH DÉLKY. App key i App secret mají 15 znaků, refresh token
 * kolem šedesáti, takže záměna polí je z délek vidět na první pohled.
 *
 * Hodnoty se nikde nevypisují a nikam neposílají. Vidí to jen tým.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const klic = process.env.DROPBOX_APP_KEY?.trim() ?? '';
  const tajne = process.env.DROPBOX_APP_SECRET?.trim() ?? '';
  const refresh = process.env.DROPBOX_REFRESH_TOKEN?.trim() ?? '';

  const delky = {
    DROPBOX_APP_KEY: { znaku: klic.length, ocekavano: 15 },
    DROPBOX_APP_SECRET: { znaku: tajne.length, ocekavano: 15 },
    DROPBOX_REFRESH_TOKEN: { znaku: refresh.length, ocekavano: '40 a víc' },
  };

  if (!klic || !tajne || !refresh) {
    return NextResponse.json({ stav: 'chybí některá proměnná', delky });
  }

  // Zkouší se přesně to, co padá v ostrém provozu - obnovení tokenu.
  let stav = 'ok';
  let odpovedDropboxu: string | null = null;
  try {
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${klic}:${tajne}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
    });
    if (!res.ok) {
      stav = `Dropbox odmítl (${res.status})`;
      // Tělo odpovědi je jen popis chyby, žádné tajemství v něm není.
      odpovedDropboxu = (await res.text()).slice(0, 300);
    }
  } catch (err) {
    stav = 'spojení s Dropboxem selhalo';
    odpovedDropboxu = err instanceof Error ? err.message : null;
  }

  /**
   * Nápověda k nejčastější záměně: do App secretu se omylem vloží refresh
   * token a naopak. Délky to prozradí dřív, než se kdokoliv začne hrabat
   * v konzoli Dropboxu.
   */
  const poznamka =
    tajne.length > 30
      ? 'DROPBOX_APP_SECRET je moc dlouhý - vypadá to, že v něm je refresh token.'
      : refresh.length < 30
        ? 'DROPBOX_REFRESH_TOKEN je moc krátký - vypadá to, že v něm je App secret.'
        : klic.length !== 15 || tajne.length !== 15
          ? 'App key nebo App secret nemá 15 znaků - nejspíš se při vkládání zkomolil.'
          : null;

  return NextResponse.json({ stav, delky, poznamka, odpovedDropboxu });
}
