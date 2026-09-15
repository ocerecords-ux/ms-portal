import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { druhNotifikaceFirmy, stavySNotifikaci } from '@/lib/notifikaceFirmy';
import { dosadPromenne } from '@/lib/vzoryZprav';
import { vzorProStav } from '@/lib/vzoryZpravServer';
import { buildStavProjektuHtml } from '@/lib/email';
import { pozdrav } from '@/lib/osloveni';
import { urlNahravek, urlPreposlechu, zakladPortalu } from '@/lib/preposlechOdkaz';


/**
 * Náhled zprávy, která jde klientovi (zadání 11. 9. 2026: „potřebuju dostat
 * ten mail, ať vím, jak to vypadá ze strany klienta").
 *
 * NIC NEODESÍLÁ a nic nemění — jen postaví přesně to HTML, co by dorazilo,
 * a vrátí ho k prohlédnutí. Rychlejší a míň otravné než posílat si zkušební
 * maily, a hlavně se dá podívat na kterýkoliv stav, ne jen na ten, ve kterém
 * projekt zrovna je (`?stav=Dokončeno - ke schválení`).
 *
 * Odkaz na přeposlech se v náhledu NEVYRÁBÍ — ukáže se ten, který projekt
 * už má, jinak ukázkový. Náhled nemá zakládat nic, co pak někde zůstane.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const projekt = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: params.id },
    select: {
      name: true,
      statusName: true,
      driveUrl: true,
      companyId: true,
      companyName: true,
      company: { select: { name: true, driveFolderUrl: true, dealsAudiobooks: true, dealsAds: true } },
      klient: { select: { name: true } },
    },
  });
  if (!projekt) return NextResponse.json({ error: 'Projekt není v portálu.' }, { status: 404 });

  // Dva druhy zprav (zadani 14. 9. 2026) - nahled musi ukazat ten, ktery
  // projektu opravdu patri, vcetne toho, ze u reklamy jde jen jeden stav.
  const druh = druhNotifikaceFirmy(projekt.company);
  const stavy = stavySNotifikaci(druh);
  const zadany = req.nextUrl.searchParams.get('stav');
  const stav = zadany && stavy.includes(zadany) ? zadany : projekt.statusName ?? '';
  if (!stavy.includes(stav)) {
    return NextResponse.json({ error: `Ke stavu „${stav}" se zpráva neposílá.` }, { status: 400 });
  }

  const zaklad = zakladPortalu();
  const slozka = projekt.driveUrl || projekt.company?.driveFolderUrl || null;

  /**
   * Nahled musi ukazovat TY SAME odkazy, co odejdou. Do 11. 9. 2026 tu stal
   * natvrdo `/nahravky?projekt=…`, tedy stranka za prihlasenim - zprava uz
   * mezitim posilala otevreny `/nahravky/<token>` a nahled o tom lhal.
   *
   * Token se tu ale NEVYRABI (nahled nema zakladat nic, co pak nekde
   * zustane) - pouzije se ten, ktery projekt uz ma.
   */
  const odkaz = await prisma.preposlechOdkaz
    .findUnique({
      where: { caflouProjectId: params.id },
      select: { token: true, zneplatnenoAt: true },
    })
    .catch(() => null);
  const platnyToken = odkaz && !odkaz.zneplatnenoAt ? odkaz.token : null;

  const odkazNaDisk = platnyToken
    ? urlNahravek(platnyToken)
    : projekt.companyId && slozka
      ? `${zaklad}/nahravky/ukazkovy-odkaz`
      : slozka;

  // O AudioTaggeru rozhoduje zaskrtavatko ve vzoru (zadani 14. 9. 2026).
  let odkazNaPreposlech: string | null = null;

  const nazevProjektu = projekt.name || `Projekt ${params.id}`;
  const nazevFirmy = projekt.company?.name ?? projekt.companyName ?? '';
  const vzor = await vzorProStav(stav, druh);
  if (vzor.audiotagger) {
    odkazNaPreposlech = platnyToken ? urlPreposlechu(platnyToken) : `${zaklad}/preposlech/ukazkovy-odkaz`;
  }
  const hodnoty = {
    projekt: nazevProjektu,
    firma: nazevFirmy,
    klient: projekt.klient?.name ?? '',
    stav,
    osloveni: pozdrav(projekt.klient?.name ?? null),
  };

  const html = buildStavProjektuHtml({
    prijemci: [],
    jenInterne: false,
    jmenoKlienta: projekt.klient?.name ?? null,
    nazevProjektu,
    nazevFirmy,
    stav,
    predmet: dosadPromenne(vzor.predmet, hodnoty),
    nadpis: dosadPromenne(vzor.nadpis, hodnoty),
    text: dosadPromenne(vzor.text, hodnoty),
    odkazNaDisk,
    popisekOdkazu: druh === 'REKLAMA' ? 'Poslechnout spot ve složce' : null,
    odkazNaPreposlech,
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
