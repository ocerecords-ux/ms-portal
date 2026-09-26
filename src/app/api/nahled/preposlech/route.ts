import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { kdoJe } from '@/lib/kdoJe';
import { isInternalRole } from '@/lib/roles';

/**
 * NÁHLED PŘEPOSLECHU POD IKONOU V PŘEHLEDU (zadání 26. 9. 2026: „u
 * audiotaggeru bych to udělal podobně. Zásadní informace a pak proklik na
 * Otevřít").
 *
 * VŠECHNO Z DATABÁZE, ani jeden dotaz na Disk: v přehledu projektů se tohle
 * okno může otevřít u kteréhokoliv řádku a čekat vteřiny na Google API kvůli
 * náhledu nedává smysl. Počet stop je poslední známý stav z AudioTaggeru
 * (PreposlechStav.pocetStop), zbytek se spočítá ze zápisů.
 */
export const dynamic = 'force-dynamic';

const den = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' })
    : null;

export async function GET(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!isInternalRole(ja.role as never)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const projekt = req.nextUrl.searchParams.get('projekt');
  if (!projekt) return NextResponse.json({ error: 'Chybí projekt.' }, { status: 400 });

  const [stav, stopy, chyby, posledniChyba, posledniStopa] = await Promise.all([
    prisma.preposlechStav.findUnique({ where: { caflouProjectId: projekt } }),
    prisma.preposlechStopa.findMany({
      where: { caflouProjectId: projekt },
      select: { hotovoAt: true },
    }),
    prisma.preposlechChyba.count({ where: { caflouProjectId: projekt } }),
    prisma.preposlechChyba.findFirst({
      where: { caflouProjectId: projekt },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, createdByName: true },
    }),
    prisma.preposlechStopa.findFirst({
      where: { caflouProjectId: projekt },
      orderBy: { poslechnutoAt: 'desc' },
      select: { poslechnutoAt: true, kdo: true },
    }),
  ]);

  const celkem = stav?.pocetStop ?? 0;
  const poslechnuto = stopy.length;
  const hotovo = stopy.filter((s) => s.hotovoAt).length;

  // Kolik z textu už klient při poslechu měl před očima (21. 9. 2026).
  const stran = stav?.slyseneStranyZ ?? stav?.textStran ?? 0;
  const slysenych = (stav?.slyseneStrany ?? []).length;
  const procent = stran > 0 ? Math.round((slysenych / stran) * 100) : null;

  const posledni =
    posledniChyba && (!posledniStopa || posledniChyba.createdAt > posledniStopa.poslechnutoAt)
      ? `${den(posledniChyba.createdAt)}${posledniChyba.createdByName ? ` · ${posledniChyba.createdByName}` : ''}`
      : posledniStopa
        ? `${den(posledniStopa.poslechnutoAt)}${posledniStopa.kdo ? ` · ${posledniStopa.kdo}` : ''}`
        : null;

  return NextResponse.json({
    nadpis: 'Přeposlech',
    odkaz: `/projekty/${encodeURIComponent(projekt)}?zalozka=preposlech`,
    tlacitko: 'Otevřít přeposlech',
    radky: [
      {
        popis: 'Stopy',
        hodnota: celkem > 0 ? `${poslechnuto} z ${celkem} poslechnuto` : 'Zatím žádné stopy',
        duraz: true,
      },
      { popis: 'Odbaveno', hodnota: celkem > 0 ? `${hotovo} z ${celkem} označeno hotovo` : '—' },
      { popis: 'Zápisy chyb', hodnota: chyby > 0 ? `${chyby}` : 'Žádné', varovani: chyby > 0 },
      ...(procent !== null
        ? [{ popis: 'Text slyšen', hodnota: `${procent} % (${slysenych} z ${stran} stran)` }]
        : []),
      {
        popis: 'Stav',
        hodnota: stav?.reviewed
          ? `Zkontrolováno${stav.reviewedAt ? ` · ${den(stav.reviewedAt)}` : ''}${stav.reviewedByName ? ` (${stav.reviewedByName})` : ''}`
          : 'Čeká na přeposlech',
      },
      ...(posledni ? [{ popis: 'Naposledy', hodnota: posledni }] : []),
    ],
  });
}
