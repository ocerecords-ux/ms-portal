import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { buildMesicniPrehledHtml } from '@/lib/email';
import { formatCzk, formatDuration } from '@/lib/timesheets';
import { minulyMesic, nazevMesice, spoctiPrehledy } from '@/lib/mesicniPrehledServer';
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
  const prehledy = await spoctiPrehledy(mesic).catch(() => []);
  const p = prehledy[0] ?? null;
  const odkaz = `${zakladPortalu()}/vykazy`;

  const html = p
    ? buildMesicniPrehledHtml({
        to: '',
        mesic: nazevMesice(mesic),
        hodiny: formatDuration(p.minut),
        castka: formatCzk(p.castka),
        celkem: formatCzk(p.castka + p.bonusCelkem),
        druhy: p.druhy.map((d) => ({
          nazev: d.nazev,
          hodiny: formatDuration(d.minut),
          castka: formatCzk(d.castka),
        })),
        projekty: p.projekty.map((pr) => ({ nazev: pr.nazev, hodiny: formatDuration(pr.minut) })),
        bonusy: p.bonusy.map((b) => ({ nazev: b.nazev, castka: formatCzk(b.castka) })),
        bonusCelkem: p.bonusCelkem > 0 ? formatCzk(p.bonusCelkem) : null,
        odkaz,
      })
    : buildMesicniPrehledHtml({
        to: '',
        mesic: nazevMesice(mesic),
        hodiny: '92 h 30 min',
        castka: '23 125 Kč',
        celkem: '24 197 Kč',
        druhy: [
          { nazev: 'Střih', hodiny: '61 h', castka: '15 250 Kč' },
          { nazev: 'Natáčení', hodiny: '31 h 30 min', castka: '7 875 Kč' },
        ],
        projekty: [
          { nazev: 'ANNA, CESTA ZE SUDET', hodiny: '38 h' },
          { nazev: 'POSLEDNÍ DOPIS', hodiny: '29 h 30 min' },
          { nazev: 'ROK PRASETE', hodiny: '25 h' },
        ],
        bonusy: [{ nazev: 'ANNA, CESTA ZE SUDET', castka: '1 072 Kč' }],
        bonusCelkem: '1 072 Kč',
        odkaz,
      });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
