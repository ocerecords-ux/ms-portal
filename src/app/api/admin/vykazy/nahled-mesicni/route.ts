import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { buildMesicniPrehledHtml } from '@/lib/email';
import {
  minulyMesic,
  nactiNastaveniPrehledu,
  spoctiPrehledy,
  vstupMailu,
} from '@/lib/mesicniPrehledServer';
import { zakladPortalu } from '@/lib/preposlechOdkaz';

/**
 * Náhled měsíčního přehledu (zadání 15. 9. 2026: „pojďme teď i rovnou
 * postavit nějaký vzor"). Nic neodesílá a nic nezapisuje.
 *
 * Bere SKUTEČNÁ data prvního zvukaře, který v daném měsíci něco vykázal —
 * ukázkový mail s vymyšlenými čísly by neukázal, jak dopadne ten pravý.
 * Když v měsíci nikdo nic nemá, vykreslí se ukázka.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const zadany = req.nextUrl.searchParams.get('mesic');
  const mesic = zadany && /^\d{4}-\d{2}$/.test(zadany) ? zadany : minulyMesic();
  const [prehledy, ulozene] = await Promise.all([
    spoctiPrehledy(mesic).catch(() => []),
    nactiNastaveniPrehledu(),
  ]);
  // Neuložené nastavení z Přehledy → Zvukaři (21. 9. 2026) - náhled vedle
  // formuláře se mění hned při klikání, ještě před uložením.
  const q = req.nextUrl.searchParams;
  const ano = (k: string, v: boolean) => (q.has(k) ? q.get(k) === '1' : v);
  const den = Number(q.get('den'));
  const nastaveni = {
    ...ulozene,
    den: den >= 1 && den <= 28 ? den : ulozene.den,
    castky: ano('castky', ulozene.castky),
    druhy: ano('druhy', ulozene.druhy),
    projekty: ano('projekty', ulozene.projekty),
    bonusy: ano('bonusy', ulozene.bonusy),
    poznamka: q.has('poznamka') ? q.get('poznamka')?.trim() || null : ulozene.poznamka,
  };
  // ?user=<id> ukáže mail konkrétního zvukaře (Přehledy → Zvukaři, 21. 9. 2026).
  const kdo = req.nextUrl.searchParams.get('user');
  const p = (kdo ? prehledy.find((x) => x.userId === kdo) : prehledy[0]) ?? null;
  const odkaz = `${zakladPortalu()}/vykazy`;

  const html = p
    ? buildMesicniPrehledHtml(vstupMailu(p, mesic, nastaveni, odkaz))
    : buildMesicniPrehledHtml(
        vstupMailu(
          {
            userId: '',
            jmeno: 'Ukázka',
            email: null,
            minut: 5550,
            castka: 23125,
            druhy: [
              { nazev: 'Střih', minut: 3660, castka: 15250 },
              { nazev: 'Natáčení', minut: 1890, castka: 7875 },
            ],
            projekty: [
              { nazev: 'ANNA, CESTA ZE SUDET', minut: 2280 },
              { nazev: 'POSLEDNÍ DOPIS', minut: 1770 },
              { nazev: 'ROK PRASETE', minut: 1500 },
            ],
            bonusy: [{ nazev: 'ANNA, CESTA ZE SUDET', castka: 1072 }],
            bonusCelkem: 1072,
          },
          mesic,
          nastaveni,
          odkaz,
        ),
      );

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
