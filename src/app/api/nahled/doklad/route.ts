import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { kdoJe } from '@/lib/kdoJe';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { stavyUpominek } from '@/lib/upominkyServer';
import { kdyOdesla, kdyPujde, popisPoradi } from '@/lib/upominkaStav';
import { odpovedChyby } from '@/lib/chybyApi';
import { formatDatum, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';

/**
 * NÁHLED DOKLADU POD IKONOU V PŘEHLEDU (zadání 26. 9. 2026: „u dokladu se
 * zobrazí náhled ve vyskakovacím okně. Ale ne celkový doklad, ale jen zásadní
 * informace typu cena, na koho byl doklad zaslán, datum splatnosti atd.
 * a pak tlačítko Otevřít doklad").
 *
 * JEN PÁR ÚDAJŮ, ne celý doklad: kdo kouká do přehledu projektů, potřebuje
 * vědět kolik, komu a do kdy - položky, sazby a poznámky patří do dokladu
 * samotného, kam vede tlačítko.
 *
 * KDO TO SMÍ VIDĚT: stejní lidé, kterým vůbec svítí ikony dokladů u názvu
 * projektu - tedy kdo má na kartě „Vidí Banku" (a Žůžo-labůžo). Peníze
 * zakázky nejsou pro každého.
 */
export const dynamic = 'force-dynamic';

/**
 * JAZYK AŽ TADY (dávka 7p, 19. 10. 2026). Okno dostává hotové řádky, ne klíče,
 * takže si routa jazyk bere z cookie přes `nactiJazyk()`. Chodí sem výhradně
 * klik z prohlížeče, nikdy cron ani akce jménem někoho jiného - výjimka
 * z dávky 7o se téhle routy netýká.
 */
const den = (jazyk: Jazyk, d: Date | null | undefined) =>
  d ? formatDatum(jazyk, d) : null;

/**
 * Stav dokladu je tu CELÁ VĚTA („Odeslaná, čeká na schválení"), ne jednoslovná
 * značka z přehledu dokladů - proto vlastní klíče. Neznámý stav projde kódem,
 * jak procházel dřív.
 */
const KLIC_STAVU_NABIDKY: Record<string, string> = {
  DRAFT: 'nahled.stavNabidky.DRAFT',
  SENT: 'nahled.stavNabidky.SENT',
  APPROVED: 'nahled.stavNabidky.APPROVED',
  REJECTED: 'nahled.stavNabidky.REJECTED',
  CANCELLED: 'nahled.stavNabidky.CANCELLED',
};

const KLIC_STAVU_FAKTURY: Record<string, string> = {
  DRAFT: 'nahled.stavFaktury.DRAFT',
  SENT: 'nahled.stavFaktury.SENT',
  PAID: 'nahled.stavFaktury.PAID',
  CANCELLED: 'nahled.stavFaktury.CANCELLED',
};

const stavNabidky = (jazyk: Jazyk, stav: string) => {
  const klic = KLIC_STAVU_NABIDKY[stav];
  return klic ? prelozit(jazyk, klic) : stav;
};

const stavFaktury = (jazyk: Jazyk, stav: string) => {
  const klic = KLIC_STAVU_FAKTURY[stav];
  return klic ? prelozit(jazyk, klic) : stav;
};

export async function GET(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return odpovedChyby('chybaApi.neprihlaseno', 401);

  const ucet = await prisma.user.findUnique({
    where: { id: ja.id },
    select: { vidiBanku: true, role: true },
  });
  if (!ucet || (!ucet.vidiBanku && ucet.role !== 'ADMIN')) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const jazyk = nactiJazyk();
  const druh = req.nextUrl.searchParams.get('druh');
  const id = req.nextUrl.searchParams.get('id');
  if (!id || (druh !== 'nabidka' && druh !== 'faktura')) {
    return odpovedChyby('nahled.chybiDoklad', 400);
  }

  if (druh === 'nabidka') {
    const n = await prisma.offer.findUnique({
      where: { id },
      include: { items: true, company: { select: { name: true } } },
    });
    if (!n) return odpovedChyby('nahled.nabidkaNenalezena', 404);
    const soucty = computeTotals(n.items, n);
    return NextResponse.json({
      nadpis: prelozitS(jazyk, 'nahled.nabidkaCislo', { cislo: n.number }),
      odkaz: `/admin/doklady/nabidky/${n.id}`,
      tlacitko: prelozit(jazyk, 'nahled.otevritNabidku'),
      radky: [
        { popis: prelozit(jazyk, 'nahled.odberatel'), hodnota: n.company?.name ?? '—' },
        { popis: prelozit(jazyk, 'nahled.predmet'), hodnota: n.subject || n.projectName || '—' },
        {
          popis: prelozit(jazyk, 'nahled.celkemSDph'),
          hodnota: formatMoney(soucty.incVat, n.currency, jazyk),
          duraz: true,
        },
        { popis: prelozit(jazyk, 'nahled.vystaveno'), hodnota: den(jazyk, n.issueDate) ?? '—' },
        { popis: prelozit(jazyk, 'nahled.platiDo'), hodnota: den(jazyk, n.validUntil) ?? '—' },
        {
          popis: prelozit(jazyk, 'nahled.odeslano'),
          hodnota: den(jazyk, n.sentAt) ?? prelozit(jazyk, 'nahled.zatimNeodeslano'),
        },
        {
          popis: prelozit(jazyk, 'nahled.stav'),
          hodnota:
            stavNabidky(jazyk, n.status) +
            (n.approvedAt
              ? ` · ${den(jazyk, n.approvedAt)}${n.approvedByName ? ` (${n.approvedByName})` : ''}`
              : ''),
        },
      ],
    });
  }

  const f = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, company: { select: { name: true } } },
  });
  if (!f) return odpovedChyby('nahled.fakturaNenalezena', 404);
  const soucty = computeTotals(f.items, f);
  /**
   * UPOMÍNKA DO BUBLINY (zadání 29. 9. 2026: „chci to vidět i v tom rychlém
   * přehledu projektu, když kliknu na ikonu dokladu"). Řádky přibudou jen
   * u faktury, které se to týká - u zaplacené ani u konceptu by to byl
   * prázdný řádek navíc.
   */
  const upominka = (await stavyUpominek([f.id])).get(f.id) ?? null;
  const poSplatnosti =
    f.status === 'SENT' && f.dueDate && f.dueDate.getTime() < Date.now()
      ? Math.floor((Date.now() - f.dueDate.getTime()) / 86400000)
      : 0;

  return NextResponse.json({
    nadpis: prelozitS(jazyk, 'nahled.fakturaCislo', { cislo: f.number }),
    odkaz: `/admin/doklady/faktury/${f.id}`,
    tlacitko: prelozit(jazyk, 'nahled.otevritFakturu'),
    radky: [
      { popis: prelozit(jazyk, 'nahled.odberatel'), hodnota: f.company?.name ?? '—' },
      {
        popis: prelozit(jazyk, 'nahled.celkemSDph'),
        hodnota: formatMoney(soucty.incVat, f.currency, jazyk),
        duraz: true,
      },
      { popis: prelozit(jazyk, 'nahled.vystaveno'), hodnota: den(jazyk, f.issueDate) ?? '—' },
      {
        popis: prelozit(jazyk, 'nahled.splatnost'),
        hodnota: `${den(jazyk, f.dueDate) ?? '—'}${poSplatnosti > 0 ? ` · ${prelozitS(jazyk, 'upominky.dniPoSplatnosti', { dnu: poSplatnosti })}` : ''}`,
        varovani: poSplatnosti > 0,
      },
      { popis: prelozit(jazyk, 'nahled.variabilniSymbol'), hodnota: f.variableSymbol },
      {
        popis: prelozit(jazyk, 'nahled.stav'),
        hodnota: stavFaktury(jazyk, f.status) + (f.paidAt ? ` · ${den(jazyk, f.paidAt)}` : ''),
      },
      ...(upominka && upominka.odeslane.length > 0
        ? [
            {
              popis: prelozit(jazyk, 'nahled.odeslaneUpominky'),
              hodnota: upominka.odeslane
                .map((o) => `${o.poradi}. ${kdyOdesla(o.kdy, jazyk)}`)
                .reverse()
                .join(' · '),
            },
          ]
        : []),
      ...(upominka?.dalsi
        ? [
            {
              popis: prelozit(jazyk, 'nahled.dalsiUpominka'),
              hodnota: `${popisPoradi(upominka.dalsi.poradi, jazyk)} ${kdyPujde(upominka.dalsi, jazyk)}`,
              // Svítí jen den dopředu - jinak by u faktury, která visí měsíc,
              // svítilo pořád něco a člověk by to přestal vnímat.
              varovani: upominka.dalsi.zaDnu <= 1,
            },
          ]
        : []),
    ],
  });
}
