import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { smiDoBanky } from '@/lib/bankaPristup';
import { ChybaVypisu, importujAboVypis } from '@/lib/bankaImportServer';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * NAHRÁNÍ VÝPISU Z ÚČTU (29. 9. 2026).
 *
 * Náhrada za stahování přes API - viz lib/bankaImportServer.ts. Soubor se
 * nikam neukládá: přečte se, pohyby se uloží a samotný výpis zahodíme.
 * Držet ho by znamenalo mít na disku kopii pohybů celé firmy navíc.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Výpis za rok má stovky kilobajtů; pět megabajtů je bohatá rezerva. */
const MAX_BAJTU = 5 * 1024 * 1024;

/**
 * Výpisy z českých bank chodí ve Windows-1250, ne v UTF-8. Když se dekóduje
 * špatně, rozsypou se jen háčky v názvech - čísla a symboly, na kterých
 * párování stojí, jsou ASCII. Proto se to nezkouší uhodnout: bere se 1250,
 * a když ho prostředí neumí, spadne se na latin1.
 */
function naText(buffer: Buffer): string {
  try {
    return new TextDecoder('windows-1250').decode(buffer);
  } catch {
    return buffer.toString('latin1');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);
  if (!(await smiDoBanky())) return odpovedChyby('chybaApi.bezOpravneni', 403);

  const formData = await req.formData().catch(() => null);
  const soubor = formData?.get('vypis');
  if (!(soubor instanceof File) || soubor.size === 0) {
    return odpovedChyby('chybaApi.nepriselZadnySoubor', 400);
  }
  if (soubor.size > MAX_BAJTU) {
    return odpovedChyby('chybaApi.vypisMocVelky', 400);
  }

  try {
    const vysledek = await importujAboVypis(naText(Buffer.from(await soubor.arrayBuffer())));
    return NextResponse.json(vysledek);
  } catch (err) {
    console.error('Import výpisu selhal:', err);
    /**
     * Hláška o špatném formátu je pro člověka, ne chyba serveru - proto 400.
     * Od dávky 7w si stav i klíč nese sama chyba (`ChybaVypisu`), takže se
     * formát nepozná hádáním podle slova „ABO" ve větě.
     */
    if (err instanceof ChybaVypisu) return odpovedChyby(err.klic, err.status);
    return odpovedChyby('chybaApi.vypisNenacten', 500);
  }
}
