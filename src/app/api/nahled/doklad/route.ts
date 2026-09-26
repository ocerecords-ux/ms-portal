import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { kdoJe } from '@/lib/kdoJe';
import { computeTotals, formatMoney } from '@/lib/doklady';

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

const den = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : null;

const STAV_NABIDKY: Record<string, string> = {
  DRAFT: 'Rozepsaná',
  SENT: 'Odeslaná, čeká na schválení',
  APPROVED: 'Schválená',
  REJECTED: 'Odmítnutá',
  CANCELLED: 'Zrušená',
};

const STAV_FAKTURY: Record<string, string> = {
  DRAFT: 'Rozepsaná',
  SENT: 'Vystavená, čeká na úhradu',
  PAID: 'Uhrazená',
  CANCELLED: 'Stornovaná',
};

export async function GET(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const ucet = await prisma.user.findUnique({
    where: { id: ja.id },
    select: { vidiBanku: true, role: true },
  });
  if (!ucet || (!ucet.vidiBanku && ucet.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const druh = req.nextUrl.searchParams.get('druh');
  const id = req.nextUrl.searchParams.get('id');
  if (!id || (druh !== 'nabidka' && druh !== 'faktura')) {
    return NextResponse.json({ error: 'Chybí doklad.' }, { status: 400 });
  }

  if (druh === 'nabidka') {
    const n = await prisma.offer.findUnique({
      where: { id },
      include: { items: true, company: { select: { name: true } } },
    });
    if (!n) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    const soucty = computeTotals(n.items, n);
    return NextResponse.json({
      nadpis: `Nabídka ${n.number}`,
      odkaz: `/admin/doklady/nabidky/${n.id}`,
      tlacitko: 'Otevřít nabídku',
      radky: [
        { popis: 'Odběratel', hodnota: n.company?.name ?? '—' },
        { popis: 'Předmět', hodnota: n.subject || n.projectName || '—' },
        { popis: 'Celkem s DPH', hodnota: formatMoney(soucty.incVat, n.currency), duraz: true },
        { popis: 'Vystaveno', hodnota: den(n.issueDate) ?? '—' },
        { popis: 'Platí do', hodnota: den(n.validUntil) ?? '—' },
        { popis: 'Odesláno', hodnota: den(n.sentAt) ?? 'Zatím neodesláno' },
        {
          popis: 'Stav',
          hodnota:
            (STAV_NABIDKY[n.status] ?? n.status) +
            (n.approvedAt ? ` · ${den(n.approvedAt)}${n.approvedByName ? ` (${n.approvedByName})` : ''}` : ''),
        },
      ],
    });
  }

  const f = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, company: { select: { name: true } } },
  });
  if (!f) return NextResponse.json({ error: 'Faktura nenalezena.' }, { status: 404 });
  const soucty = computeTotals(f.items, f);
  const poSplatnosti =
    f.status === 'SENT' && f.dueDate && f.dueDate.getTime() < Date.now()
      ? Math.floor((Date.now() - f.dueDate.getTime()) / 86400000)
      : 0;

  return NextResponse.json({
    nadpis: `Faktura ${f.number}`,
    odkaz: `/admin/doklady/faktury/${f.id}`,
    tlacitko: 'Otevřít fakturu',
    radky: [
      { popis: 'Odběratel', hodnota: f.company?.name ?? '—' },
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
