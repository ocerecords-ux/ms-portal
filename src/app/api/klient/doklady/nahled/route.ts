import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { cisloObjednavky } from '@/lib/dokladyKlientaServer';
import { popisObjednavky } from '@/lib/objednavkaKlientaServer';
import { odpovedChyby } from '@/lib/chybyApi';
import { formatDatum, prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';
import { nactiJazyk } from '@/lib/jazykServer';

/**
 * NÁHLED DOKLADU POD IKONOU V KLIENTSKÉM PŘEHLEDU (zadání 1. 10. 2026: „když
 * kliknu na tu ikonu, tak to bude vypadat a fungovat, jako to máme my
 * u projektů + tlačítko kde se otevře celý náhled PDF a půjde i stáhnout").
 *
 * Je to dvojče /api/nahled/doklad, ale pro druhou stranu stolu, a proto
 * samostatná routa, ne další větev v té naší:
 *  - PRÁVA jsou jiná: tam „vidí Banku", tady „je to doklad mé firmy",
 *  - OBSAH je jiný: klientovi se neukazuje, jestli jsme mu poslali upomínku
 *    a kolik je po splatnosti dní podle nás,
 *  - TLAČÍTKO vede na PDF, ne do administrace, kam se klient nedostane.
 *
 * Rozepsané doklady se sem nedostanou vůbec — viz lib/dokladyKlientaServer.ts.
 */
export const dynamic = 'force-dynamic';

/**
 * JAZYK AŽ TADY (dávka 7p, 19. 10. 2026). Okno dostává hotové řádky, ne klíče,
 * takže si routa jazyk bere z cookie přes `nactiJazyk()` - a tady na tom
 * záleží nejvíc, kouká se do něj anglicky mluvící klient. Chodí sem výhradně
 * klik z prohlížeče, takže výjimka z dávky 7o (cron) se routy netýká.
 */
const den = (jazyk: Jazyk, d: Date | null | undefined) => (d ? formatDatum(jazyk, d) : null);

/**
 * Klient vidí u nabídky jinou sadu stavů než my - „čeká na schválení", ne
 * „odeslaná, čeká na schválení". Rozepsané doklady se k němu nedostanou vůbec.
 */
const KLIC_STAVU_NABIDKY: Record<string, string> = {
  SENT: 'nahled.stavNabidkyKlient.SENT',
  APPROVED: 'nahled.stavNabidky.APPROVED',
  REJECTED: 'nahled.stavNabidky.REJECTED',
};

const KLIC_STAVU_FAKTURY: Record<string, string> = {
  SENT: 'nahled.stavFaktury.SENT',
  PAID: 'nahled.stavFaktury.PAID',
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return odpovedChyby('chybaApi.neprihlaseno', 401);
  // Klic tenant izolace: companyId vyhradne ze session, nikdy z adresy.
  const companyId = session.user.companyId;
  if (!companyId) return odpovedChyby('nahled.uceBezFirmy', 403);

  const jazyk = nactiJazyk();
  const druh = req.nextUrl.searchParams.get('druh');
  const id = req.nextUrl.searchParams.get('id');
  if (!id || (druh !== 'nabidka' && druh !== 'faktura' && druh !== 'objednavka')) {
    return odpovedChyby('nahled.chybiDoklad', 400);
  }

  const pdf = (d: string) => `/api/klient/doklady/pdf?druh=${d}&id=${encodeURIComponent(id)}`;

  if (druh === 'nabidka') {
    const n = await prisma.offer.findFirst({
      where: { id, companyId, status: { in: ['SENT', 'APPROVED', 'REJECTED'] } },
      include: { items: true },
    });
    if (!n) return odpovedChyby('nahled.nabidkaNenalezena', 404);
    const soucty = computeTotals(n.items, n);
    return NextResponse.json({
      nadpis: prelozitS(jazyk, 'nahled.nabidkaCislo', { cislo: n.number }),
      odkaz: pdf('nabidka'),
      stahnout: `${pdf('nabidka')}&stahnout=1`,
      novaZalozka: true,
      tlacitko: prelozit(jazyk, 'nahled.otevritNabidku'),
      radky: [
        { popis: prelozit(jazyk, 'nahled.predmet'), hodnota: n.subject || n.projectName || '—' },
        {
          popis: prelozit(jazyk, 'nahled.celkemSDph'),
          hodnota: formatMoney(soucty.incVat, n.currency, jazyk),
          duraz: true,
        },
        { popis: prelozit(jazyk, 'nahled.vystaveno'), hodnota: den(jazyk, n.issueDate) ?? '—' },
        { popis: prelozit(jazyk, 'nahled.platiDo'), hodnota: den(jazyk, n.validUntil) ?? '—' },
        { popis: prelozit(jazyk, 'nahled.stav'), hodnota: stavNabidky(jazyk, n.status) },
      ],
    });
  }

  if (druh === 'faktura') {
    const f = await prisma.invoice.findFirst({
      where: { id, companyId, status: { in: ['SENT', 'PAID'] } },
      include: { items: true },
    });
    if (!f) return odpovedChyby('nahled.fakturaNenalezena', 404);
    const soucty = computeTotals(f.items, f);
    /**
     * Po splatnosti se píše jen u NEZAPLACENÉ faktury a bez našich upomínek:
     * klientovi stačí, že to visí, a kolikátou upomínku mu chystáme, do jeho
     * přehledu nepatří.
     */
    const poSplatnosti =
      f.status === 'SENT' && f.dueDate && f.dueDate.getTime() < Date.now()
        ? Math.floor((Date.now() - f.dueDate.getTime()) / 86400000)
        : 0;
    return NextResponse.json({
      nadpis: prelozitS(jazyk, 'nahled.fakturaCislo', { cislo: f.number }),
      odkaz: pdf('faktura'),
      stahnout: `${pdf('faktura')}&stahnout=1`,
      novaZalozka: true,
      tlacitko: prelozit(jazyk, 'nahled.otevritFakturu'),
      radky: [
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
      ],
    });
  }

  const o = await prisma.order.findFirst({ where: { id, companyId } });
  if (!o) return odpovedChyby('nahled.objednavkaNenalezena', 404);
  return NextResponse.json({
    nadpis: prelozitS(jazyk, 'nahled.objednavkaCislo', { cislo: cisloObjednavky(o.id) }),
    odkaz: pdf('objednavka'),
    stahnout: `${pdf('objednavka')}&stahnout=1`,
    novaZalozka: true,
    tlacitko: prelozit(jazyk, 'nahled.otevritObjednavku'),
    // ŘÁDKY OBJEDNÁVKY ZŮSTÁVAJÍ ČESKY (dávka 7p): skládá je `popisObjednavky`
    // v `lib/objednavkaKlientaServer.ts`, které ze stejného zdroje čte i PDF
    // objednávky - a to se řídí jazykem dokladu, ne přepínačem v liště
    // (pravidlo 5). Přeložit to je vlastní úkol, viz docs/preklad-portalu.md.
    radky: popisObjednavky(o).radky.slice(0, 6),
  });
}
