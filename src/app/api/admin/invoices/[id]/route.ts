import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { expandNumberFormat } from '@/lib/doklady';
import { CURRENCIES } from '@/lib/doklady';
import { getRateForCurrency } from '@/lib/cnb';
import { resolveProject } from '@/lib/projectOptions';

// Uprava faktury (zadani 6. 9. 2026). Polozky se posilaji vzdy cele.
const itemSchema = z.object({
  description: z.string().trim().min(1, 'Vyplňte popis položky.').max(300),
  quantity: z.number().finite().min(0),
  unit: z.string().trim().max(20).optional(),
  unitPriceMinor: z.number().int(),
  vatRate: z.number().int().min(0).max(100),
});

const schema = z.object({
  companyId: z.string().trim().min(1).optional(),
  bankAccountId: z.string().trim().nullable().optional(),
  currency: z.enum(CURRENCIES).optional(),
  issueDate: z.string().trim().min(8).optional(),
  taxDate: z.string().trim().nullable().optional(),
  dueDate: z.string().trim().nullable().optional(),
  subject: z.string().trim().max(200).optional(),
  note: z.string().trim().max(3000).optional(),
  variableSymbol: z.string().trim().max(20).optional(),
  caflouProjectId: z.string().trim().nullable().optional(),
  items: z.array(itemSchema).max(100).optional(),
  /** Znovu si říct ČNB o kurz k datu vystavení. */
  refreshRate: z.boolean().optional(),
});

function toDate(value: string): Date | null {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!invoice) return NextResponse.json({ error: 'Faktura nenalezena.' }, { status: 404 });
    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Uhrazenou fakturu už neměňte — nejdřív zrušte úhradu.' }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (d.companyId !== undefined) data.companyId = d.companyId;
    if (d.bankAccountId !== undefined) data.bankAccountId = d.bankAccountId || null;
    if (d.currency !== undefined) data.currency = d.currency;
    if (d.subject !== undefined) data.subject = d.subject || null;
    if (d.note !== undefined) data.note = d.note || null;
    if (d.variableSymbol !== undefined) data.variableSymbol = d.variableSymbol || invoice.variableSymbol;
    if (d.caflouProjectId !== undefined) {
      const projekt = await resolveProject(d.caflouProjectId);
      data.caflouProjectId = projekt.caflouProjectId;
      data.projectName = projekt.projectName;
    }

    let issueDate = invoice.issueDate;
    if (d.issueDate !== undefined) {
      const date = toDate(d.issueDate);
      if (!date) return NextResponse.json({ error: 'Neplatné datum vystavení.' }, { status: 400 });
      data.issueDate = date;
      issueDate = date;
    }
    for (const [key, value] of [
      ['taxDate', d.taxDate],
      ['dueDate', d.dueDate],
    ] as const) {
      if (value === undefined) continue;
      if (!value) {
        data[key] = null;
        continue;
      }
      const date = toDate(value);
      if (!date) return NextResponse.json({ error: 'Neplatné datum.' }, { status: 400 });
      data[key] = date;
    }

    // Kurz CNB k datu vystaveni - buď na vyzadani, nebo kdyz se zmenila mena.
    const currency = d.currency ?? invoice.currency;
    if (d.refreshRate || (d.currency && d.currency !== invoice.currency)) {
      const rate = await getRateForCurrency(currency, issueDate);
      if (rate) {
        data.exchangeRate = rate.rate;
        data.exchangeRateDate = issueDate;
      } else if (currency === 'CZK') {
        data.exchangeRate = 1;
        data.exchangeRateDate = issueDate;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: params.id }, data });
      if (d.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
        if (d.items.length > 0) {
          await tx.invoiceItem.createMany({
            data: d.items.map((item, index) => ({
              invoiceId: params.id,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit || null,
              unitPriceMinor: item.unitPriceMinor,
              vatRate: item.vatRate,
              sortOrder: (index + 1) * 10,
            })),
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/invoices/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { status: true, number: true, issuerCompanyId: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Faktura nenalezena.' }, { status: 404 });

    // Odeslanou nebo uhrazenou fakturu nemazeme - ucetne musi zustat, jen se
    // stornuje, aby v ciselne rade nebyla díra.
    if (invoice.status !== 'DRAFT') {
      await prisma.invoice.update({ where: { id: params.id }, data: { status: 'CANCELLED' } });
      return NextResponse.json({ ok: true, cancelledInsteadOfDeleted: true });
    }

    // Zahozeny rozpracovany doklad vrati sve cislo do rady - jinak by kazda
    // faktura, kterou si nekdo jen vyzkousi z nabidky a zase ji smaze,
    // udelala v ciselne rade diru (zadani 8. 9. 2026: fakturu z nabidky chci
    // nejdriv videt v editaci a teprve pak ulozit).
    const issuer = await prisma.issuerCompany.findUnique({
      where: { id: invoice.issuerCompanyId },
      select: { invoiceNextNumber: true, invoiceNumberFormat: true },
    });
    const bylaPosledni =
      issuer !== null &&
      expandNumberFormat(issuer.invoiceNumberFormat, issuer.invoiceNextNumber - 1) === invoice.number;

    await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id: params.id } });
      if (bylaPosledni && issuer) {
        await tx.issuerCompany.update({
          where: { id: invoice.issuerCompanyId },
          data: { invoiceNextNumber: issuer.invoiceNextNumber - 1 },
        });
      }
    });
    return NextResponse.json({ ok: true, cisloVraceno: bylaPosledni });
  } catch (err) {
    console.error('DELETE /api/admin/invoices/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
