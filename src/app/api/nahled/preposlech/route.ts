import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { kdoJe } from '@/lib/kdoJe';
import { isInternalRole } from '@/lib/roles';
import { odpovedChyby } from '@/lib/chybyApi';
import { kodJazyka, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';

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

/**
 * JAZYK AŽ TADY (dávka 7p, 19. 10. 2026). Okno dostává hotové řádky, ne klíče,
 * takže si routa jazyk musí vzít sama - z cookie, kterou nastavuje přepínač
 * v liště. Chodí sem výhradně klik z prohlížeče, takže cookie je vždycky
 * k dispozici; výjimka z dávky 7o (cron a akce jménem někoho jiného) se téhle
 * routy netýká.
 */
const den = (jazyk: Jazyk, d: Date | null | undefined) =>
  d
    ? new Intl.DateTimeFormat(kodJazyka(jazyk), {
        timeZone: 'Europe/Prague',
        day: 'numeric',
        month: 'numeric',
      }).format(d) +
      ' ' +
      new Intl.DateTimeFormat(kodJazyka(jazyk), {
        timeZone: 'Europe/Prague',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d)
    : null;

export async function GET(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return odpovedChyby('chybaApi.neprihlaseno', 401);
  if (!isInternalRole(ja.role as never)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const jazyk = nactiJazyk();
  const projekt = req.nextUrl.searchParams.get('projekt');
  if (!projekt) return odpovedChyby('chybaApi.chybiProjekt', 400);

  const [stav, stopy, chyby, posledniChyba, posledniStopa] = await Promise.all([
    prisma.preposlechStav.findUnique({ where: { caflouProjectId: projekt } }),
    prisma.preposlechStopa.findMany({
      where: { caflouProjectId: projekt },
      // Odskrtnuto nami i klientem (20. 10. 2026) - okno je interni, takze
      // ukazuje obe strany; viz PreposlechStopa.hotovoInterniAt.
      select: { hotovoAt: true, hotovoInterniAt: true },
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
  const hotovo = stopy.filter((s) => s.hotovoAt || s.hotovoInterniAt).length;

  // Kolik z textu už klient při poslechu měl před očima (21. 9. 2026).
  const stran = stav?.slyseneStranyZ ?? stav?.textStran ?? 0;
  const slysenych = (stav?.slyseneStrany ?? []).length;
  const procent = stran > 0 ? Math.round((slysenych / stran) * 100) : null;

  const posledni =
    posledniChyba && (!posledniStopa || posledniChyba.createdAt > posledniStopa.poslechnutoAt)
      ? `${den(jazyk, posledniChyba.createdAt)}${posledniChyba.createdByName ? ` · ${posledniChyba.createdByName}` : ''}`
      : posledniStopa
        ? `${den(jazyk, posledniStopa.poslechnutoAt)}${posledniStopa.kdo ? ` · ${posledniStopa.kdo}` : ''}`
        : null;

  return NextResponse.json({
    nadpis: prelozit(jazyk, 'nahled.preposlech'),
    odkaz: `/projekty/${encodeURIComponent(projekt)}?zalozka=preposlech`,
    tlacitko: prelozit(jazyk, 'nahled.otevritPreposlech'),
    radky: [
      {
        popis: prelozit(jazyk, 'nahled.stopy'),
        hodnota:
          celkem > 0
            ? prelozitS(jazyk, 'nahled.stopyPoslechnuto', { poslechnuto, celkem })
            : prelozit(jazyk, 'nahled.zadneStopy'),
        duraz: true,
      },
      {
        popis: prelozit(jazyk, 'nahled.odbaveno'),
        hodnota: celkem > 0 ? prelozitS(jazyk, 'nahled.odbavenoHotovo', { hotovo, celkem }) : '—',
      },
      {
        popis: prelozit(jazyk, 'nahled.zapisyChyb'),
        hodnota: chyby > 0 ? `${chyby}` : prelozit(jazyk, 'nahled.zadne'),
        varovani: chyby > 0,
      },
      ...(procent !== null
        ? [
            {
              popis: prelozit(jazyk, 'nahled.textSlysen'),
              hodnota: prelozitS(jazyk, 'nahled.textSlysenHodnota', {
                procent,
                slysenych,
                stran,
              }),
            },
          ]
        : []),
      {
        popis: prelozit(jazyk, 'nahled.stav'),
        hodnota: stav?.reviewed
          ? `${prelozit(jazyk, 'nahled.zkontrolovano')}${stav.reviewedAt ? ` · ${den(jazyk, stav.reviewedAt)}` : ''}${stav.reviewedByName ? ` (${stav.reviewedByName})` : ''}`
          : prelozit(jazyk, 'nahled.cekaNaPreposlech'),
      },
      ...(posledni ? [{ popis: prelozit(jazyk, 'nahled.naposledy'), hodnota: posledni }] : []),
    ],
  });
}
