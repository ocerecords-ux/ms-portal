import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { zkusUloziste } from '@/lib/storage';

/**
 * Zkouska spojeni s uloziste souboru (9. 9. 2026). Jen pro Zuzo-labuzo.
 *
 * PROC TO VZNIKLO
 * Nahravani priloh z prohlizece koncilo na "Failed to fetch" a z toho se
 * neda poznat vubec nic: stejne se totiz projevi chybejici hlavicky CORS
 * i odmitnuty podpis. Prohlizec u odpovedi bez hlavicek CORS nepusti ke
 * skriptu ani stavovy kod, takze se nedalo rozlisit, jestli je spatne
 * nastaveni bucketu, nebo pristupove klice.
 *
 * Tenhle endpoint se na uloziste zepta ZE SERVERU, kde zadne CORS neplati.
 * Kdyz projde, je chyba na strane prohlizece (CORS u bucketu). Kdyz
 * neprojde, sedi chyba v klicich nebo v adrese - a rovnou je videt jaka.
 *
 * Zadne tajne hodnoty nevraci, jen vysledek a text chyby od uloziste.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const vysledek = await zkusUloziste();
  return NextResponse.json(vysledek, { status: vysledek.ok ? 200 : 500 });
}
