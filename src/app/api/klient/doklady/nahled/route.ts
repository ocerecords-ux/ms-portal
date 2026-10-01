import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { cisloObjednavky } from '@/lib/dokladyKlientaServer';
import { popisObjednavky } from '@/lib/objednavkaKlientaServer';

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

const den = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : null;

const STAV_NABIDKY: Record<string, string> = {
  SENT: 'Čeká na schválení',
  APPROVED: 'Schválená',
  REJECTED: 'Odmítnutá',
};

const STAV_FAKTURY: Record<string, string> = {
  SENT: 'Vystavená, čeká na úhradu',
  PAID: 'Uhrazená',
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  // Klic tenant izolace: companyId vyhradne ze session, nikdy z adresy.
  const companyId = session.user.companyId;
  if (!companyId) return NextResponse.json({ error: 'Účet nepatří pod firmu.' }, { status: 403 });

  const druh = req.nextUrl.searchParams.get('druh');
  const id = req.nextUrl.searchParams.get('id');
  if (!id || (druh !== 'nabidka' && druh !== 'faktura' && druh !== 'objednavka')) {
    return NextResponse.json({ error: 'Chybí doklad.' }, { status: 400 });
  }

  const pdf = (d: string) => `/api/klient/doklady/pdf?druh=${d}&id=${encodeURIComponent(id)}`;

  if (druh === 'nabidka') {
    const n = await prisma.offer.findFirst({
      where: { id, companyId, status: { in: ['SENT', 'APPROVED', 'REJECTED'] } },
      include: { items: true },
    });
    if (!n) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    const soucty = computeTotals(n.items, n);
    return NextResponse.json({
      nadpis: `Nabídka ${n.number}`,
      odkaz: pdf('nabidka'),
      stahnout: `${pdf('nabidka')}&stahnout=1`,
      novaZalozka: true,
      tlacitko: 'Otevřít nabídku',
      radky: [
        { popis: 'Předmět', hodnota: n.subject || n.projectName || '—' },
        { popis: 'Celkem s DPH', hodnota: formatMoney(soucty.incVat, n.currency), duraz: true },
        { popis: 'Vystaveno', hodnota: den(n.issueDate) ?? '—' },
        { popis: 'Platí do', hodnota: den(n.validUntil) ?? '—' },
        { popis: 'Stav', hodnota: STAV_NABIDKY[n.status] ?? n.status },
      ],
    });
  }

  if (druh === 'faktura') {
    const f = await prisma.invoice.findFirst({
      where: { id, companyId, status: { in: ['SENT', 'PAID'] } },
      include: { items: true },
    });
    if (!f) return NextResponse.json({ error: 'Faktura nenalezena.' }, { status: 404 });
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
      nadpis: `Faktura ${f.number}`,
      odkaz: pdf('faktura'),
      stahnout: `${pdf('faktura')}&stahnout=1`,
      novaZalozka: true,
      tlacitko: 'Otevřít fakturu',
      radky: [
        { popis: 'Celkem s DPH', hodnota: formatMoney(soucty.incVat, f.currency), duraz: true },
        { popis: 'Vystaveno', hodnota: den(f.issueDate) ?? '—' },
        {
          popis: 'Splatnost',
          hodnota: `${den(f.dueDate) ?? '—'}${poSplatnosti > 0 ? ` · ${poSplatnosti} dní po splatnosti` : ''}`,
          varovani: poSplatnosti > 0,
        },
        { popis: 'Variabilní symbol', hodnota: f.variableSymbol },
        {
          popis: 'Stav',
          hodnota: (STAV_FAKTURY[f.status] ?? f.status) + (f.paidAt ? ` · ${den(f.paidAt)}` : ''),
        },
      ],
    });
  }

  const o = await prisma.order.findFirst({ where: { id, companyId } });
  if (!o) return NextResponse.json({ error: 'Objednávka nenalezena.' }, { status: 404 });
  return NextResponse.json({
    nadpis: `Objednávka ${cisloObjednavky(o.id)}`,
    odkaz: pdf('objednavka'),
    stahnout: `${pdf('objednavka')}&stahnout=1`,
    novaZalozka: true,
    tlacitko: 'Otevřít objednávku',
    radky: popisObjednavky(o).radky.slice(0, 6),
  });
}
