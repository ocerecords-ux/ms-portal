import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { preklopNaNataceni } from '@/lib/zacatekNataceniServer';

/**
 * Ranní překlopení projektů, které dnes mají první frekvenci, na „Natáčíme"
 * (zadání 25. 9. 2026). Pouští to Vercel Cron - viz vercel.json; ručně ji smí
 * spustit přihlášené Žůžo-labůžo.
 *
 * Běží brzy ráno, aby stav platil dřív, než někdo přijde do studia.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    const vysledek = await preklopNaNataceni();
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Preklopeni na "Nataceni" selhalo:', err);
    return NextResponse.json({ error: 'Překlopení se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
