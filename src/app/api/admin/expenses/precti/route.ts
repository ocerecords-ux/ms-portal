import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { MAX_FOTKA_BYTES } from '@/lib/uctenka';
import { prectiUctenku } from '@/lib/uctenkaServer';

/**
 * Přečtení vyfoceného dokladu (zadání 10. 9. 2026).
 *
 * Fotka sem přijde z formuláře výdaje, projde přečtením a rovnou se zahodí -
 * ukládá se až s dokladem, a to jinou cestou (/api/admin/expenses). Zpátky
 * chodí jen údaje k předvyplnění, uložit je musí člověk.
 */
export const dynamic = 'force-dynamic';
// Čtení fotky trvá pár vteřin, výchozích deset by na horším signálu nestačilo.
export const maxDuration = 60;

const POVOLENE_TYPY = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  const soubor = formData?.get('fotka');
  if (!(soubor instanceof File) || soubor.size === 0) {
    return NextResponse.json({ error: 'Chybí fotka dokladu.' }, { status: 400 });
  }
  if (soubor.size > MAX_FOTKA_BYTES) {
    return NextResponse.json({ error: 'Fotka je moc velká.' }, { status: 400 });
  }

  // HEIC z iPhonu model nepřečte; ať to formulář ví a řekne to rovnou,
  // místo aby čekal na odpověď, která stejně nic nenajde.
  const typ = soubor.type.toLowerCase();
  if (!POVOLENE_TYPY.includes(typ)) {
    return NextResponse.json({ error: 'Tenhle formát obrázku číst neumíme.' }, { status: 400 });
  }
  if (typ === 'image/heic' || typ === 'image/heif') {
    return NextResponse.json(
      { error: 'Fotka je ve formátu HEIC. V nastavení fotoaparátu přepněte na „Nejkompatibilnější".' },
      { status: 400 },
    );
  }

  const vysledek = await prectiUctenku(Buffer.from(await soubor.arrayBuffer()), typ);

  if (vysledek.stav === 'vypnuto') {
    return NextResponse.json({ error: 'Čtení dokladů zatím není nastavené.' }, { status: 503 });
  }
  if (vysledek.stav === 'chyba') {
    return NextResponse.json({ error: vysledek.zprava }, { status: 502 });
  }
  return NextResponse.json(vysledek.uctenka);
}
