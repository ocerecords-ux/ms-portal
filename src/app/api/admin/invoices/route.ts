import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { expandNumberFormat } from '@/lib/doklady';
import { getRateForCurrency } from '@/lib/cnb';

// Zalozeni faktury (zadani 6. 9. 2026). Cislo se bere z ciselne rady vlastni
// firmy a rada se rovnou posune.
//
// Faktura muze vzniknout i z odsouhlasene nabidky - pak se prevezme odberatel,
// mena, predmet i vsechny polozky, aby se nic neprepisovalo rucne.
// Kdyz faktura vznika z nabidky, chodi sem uz UPRAVENY doklad - stranka
// /admin/doklady/faktury/nova ho necha projit a teprve Ulozit posle tohle
// (zadani 8. 9. 2026). Co neprijde, se dopocita z nabidky jako driv.
const itemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number(),
  unit: z.string().trim().max(20).optional(),
  unitPriceMinor: z.number().int(),
  vatRate: z.number().int(),
});

const schema = z.object({
  issuerCompanyId: z.string().trim().min(1, 'Vyberte, za kterou firmu fakturujete.').optional(),
  companyId: z.string().trim().min(1, 'Vyberte odběratele.').optional(),
  subject: z.string().trim().max(200).optional(),
  offerId: z.string().trim().min(1).optional(),
  note: z.string().trim().max(2000).optional(),
  variableSymbol: z.string().trim().max(20).optional(),
  bankAccountId: z.string().trim().min(1).nullable().optional(),
  issueDate: z.string().trim().optional(),
  taxDate: z.string().trim().nullable().optional(),
  dueDate: z.string().trim().nullable().optional(),
  items: z.array(itemSchema).max(100).optional(),
});

/** "2026-09-08" -> Date; co neni datum, bereme jako nevyplnene. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const input = parsed.data;

    // Z nabidky prebirame vsechno - a to jen z odsouhlasene.
    let offer = null;
    if (input.offerId) {
      offer = await prisma.offer.findUnique({
        where: { id: input.offerId },
        include: { items: { orderBy: { sortOrder: 'asc' } }, invoice: { select: { id: true } } },
      });
      if (!offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
      // Puvodne slo fakturovat jen z odsouhlasene nabidky. Schvalovani pres
      // odkaz je ale dobrovolne a casto se domlouva jinak (telefon, e-mail),
      // takze cekat na nej znamenalo, ze fakturu z nabidky nesel vystavit
      // vubec (zadani 8. 9. 2026: "potreboval bych, aby z nabidky sla
      // vytvorit faktura"). Brani se uz jen odmitnuta nabidka.
      if (offer.status === 'REJECTED') {
        return NextResponse.json({ error: 'Tuhle nabídku klient odmítl.' }, { status: 409 });
      }
      if (offer.invoice) {
        return NextResponse.json(
          { error: 'Z téhle nabídky už faktura vystavená je.', invoiceId: offer.invoice.id },
          { status: 409 },
        );
      }
    }

    const issuerCompanyId = offer?.issuerCompanyId ?? input.issuerCompanyId;
    const companyId = offer?.companyId ?? input.companyId;
    if (!issuerCompanyId || !companyId) {
      return NextResponse.json({ error: 'Chybí vystavovatel nebo odběratel.' }, { status: 400 });
    }

    const issuer = await prisma.issuerCompany.findUnique({ where: { id: issuerCompanyId } });
    if (!issuer) return NextResponse.json({ error: 'Vlastní firma nenalezena.' }, { status: 404 });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: 'Odběratel nenalezen.' }, { status: 404 });

    const currency = offer?.currency ?? issuer.defaultCurrency;

    // Denni kurz CNB k dnesnimu dni. Kdyz se CNB nepodari zeptat, ulozime 1 a
    // kurz jde doplnit rucne - kvuli tomu faktura padat nebude.
    const rate = await getRateForCurrency(currency);

    // Datumy z formulare maji prednost; kdyz neprijdou, plati dnesek a
    // splatnost podle karty odberatele.
    const issueDate = toDate(input.issueDate) ?? new Date();
    const dueDate =
      toDate(input.dueDate) ??
      (() => {
        const d = new Date(issueDate);
        d.setDate(d.getDate() + (company.paymentTermDays ?? 14));
        return d;
      })();
    const taxDate = toDate(input.taxDate) ?? issueDate;

    // Ucet z formulare, jinak vychozi ve mene dokladu.
    const account =
      input.bankAccountId === undefined
        ? await prisma.bankAccount.findFirst({
            where: { issuerCompanyId, currency },
            orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
            select: { id: true },
          })
        : input.bankAccountId
          ? await prisma.bankAccount.findFirst({
              where: { id: input.bankAccountId, issuerCompanyId },
              select: { id: true },
            })
          : null;

    // Polozky: upravene z formulare, jinak presne ty z nabidky.
    const polozky =
      input.items ??
      (offer?.items ?? []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceMinor: item.unitPriceMinor,
        vatRate: item.vatRate,
      }));

    let created = null;
    let sequence = issuer.invoiceNextNumber;
    for (let attempt = 0; attempt < 20 && !created; attempt++) {
      const number = expandNumberFormat(issuer.invoiceNumberFormat, sequence);
      const exists = await prisma.invoice.findUnique({ where: { number }, select: { id: true } });
      if (exists) {
        sequence += 1;
        continue;
      }
      const seq = sequence;
      created = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            number,
            // Variabilni symbol = cislo faktury bez necislic. Podle nej se pak
            // budou parovat platby z banky.
            variableSymbol: input.variableSymbol?.trim() || number.replace(/\D/g, '') || String(seq),
            issuerCompanyId,
            companyId,
            bankAccountId: account?.id ?? null,
            currency,
            exchangeRate: rate?.rate ?? 1,
            exchangeRateDate: rate ? new Date() : null,
            issueDate,
            taxDate,
            dueDate,
            subject: input.subject ?? offer?.subject ?? null,
            note: input.note ?? offer?.note ?? null,
            offerId: offer?.id ?? null,
            ...(polozky.length > 0
              ? {
                  items: {
                    create: polozky.map((item, index) => ({
                      description: item.description,
                      quantity: item.quantity,
                      unit: item.unit || 'ks',
                      unitPriceMinor: item.unitPriceMinor,
                      vatRate: item.vatRate,
                      sortOrder: (index + 1) * 10,
                    })),
                  },
                }
              : {}),
          },
        });
        await tx.issuerCompany.update({
          where: { id: issuerCompanyId },
          data: { invoiceNextNumber: seq + 1 },
        });
        return invoice;
      });
    }

    if (!created) {
      return NextResponse.json({ error: 'Nepodařilo se přidělit číslo faktury.' }, { status: 409 });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/invoices selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Založení se nezdařilo (${message}).` }, { status: 500 });
  }
}
