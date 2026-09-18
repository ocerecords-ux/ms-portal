import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { buildStavProjektuHtml } from '@/lib/email';
import { dosadPromenne, ukazkoveHodnoty } from '@/lib/vzoryZprav';
import { zakladPortalu } from '@/lib/preposlechOdkaz';

/**
 * Náhled ROZEPSANÉHO vzoru (zadání 11. 9. 2026). Nic neukládá a nic
 * neodesílá — postaví HTML z toho, co má člověk zrovna ve formuláři, aby
 * bylo vidět, jak zpráva dopadne, ještě než se uloží.
 *
 * Proměnné se dosazují ukázkovými hodnotami; skutečná zpráva si je vezme
 * z projektu.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const telo = (await req.json().catch(() => null)) as
    | { druh?: string; stav?: string; predmet?: string; nadpis?: string; text?: string; audiotagger?: boolean }
    | null;
  const stav = String(telo?.stav ?? '');
  const jeReklama = telo?.druh === 'REKLAMA';
  if (!stav) return NextResponse.json({ error: 'Chybí stav.' }, { status: 400 });

  const hodnoty = ukazkoveHodnoty(stav);
  const zaklad = zakladPortalu();

  const html = buildStavProjektuHtml({
    prijemci: [],
    jenInterne: false,
    jmenoKlienta: hodnoty.klient,
    nazevProjektu: hodnoty.projekt,
    nazevFirmy: hodnoty.firma,
    stav,
    // Predmet je videt i na fialovem pruhu v hlavicce - viz
    // sendStavProjektuEmail (zadani 14. 9. 2026).
    predmet: dosadPromenne(String(telo?.predmet ?? ''), hodnoty),
    nadpis: dosadPromenne(String(telo?.nadpis ?? ''), hodnoty),
    text: dosadPromenne(String(telo?.text ?? ''), hodnoty),
    odkazNaDisk: `${zaklad}/nahravky`,
    // O AudioTaggeru rozhoduje zaskrtavatko ve vzoru (zadani 14. 9. 2026) -
    // nahled to musi ukazat stejne jako mail.
    odkazNaPreposlech: telo?.audiotagger ? `${zaklad}/preposlech/ukazkovy-odkaz` : null,
    popisekOdkazu: jeReklama ? 'Otevřít' : null,
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
