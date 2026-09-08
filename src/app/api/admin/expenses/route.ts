import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { uploadExpenseAttachment } from '@/lib/storage';
import { getRateForCurrency } from '@/lib/cnb';
import { CURRENCIES, parseMoneyToMinor } from '@/lib/doklady';

// Zalozeni prijateho dokladu (zadani 6. 9. 2026). Posila se jako FormData,
// protoze u dokladu byva priloha - PDF nebo foto uctenky.
export const dynamic = 'force-dynamic';

const schema = z.object({
  number: z.string().trim().max(60).optional(),
  supplierCompanyId: z.string().trim().optional(),
  supplierName: z.string().trim().max(200).optional(),
  categoryId: z.string().trim().optional(),
  issuerCompanyId: z.string().trim().optional(),
  currency: z.enum(CURRENCIES),
  description: z.string().trim().max(300).optional(),
  amount: z.string().trim(),
  vatRate: z.coerce.number().int().min(0).max(100),
  issueDate: z.string().trim().min(8),
  dueDate: z.string().trim().optional(),
  paid: z.enum(['true', 'false']).optional(),
  note: z.string().trim().max(2000).optional(),
});

function readForm(formData: FormData) {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  return {
    number: get('number'),
    supplierCompanyId: get('supplierCompanyId'),
    supplierName: get('supplierName'),
    categoryId: get('categoryId'),
    issuerCompanyId: get('issuerCompanyId'),
    currency: get('currency'),
    description: get('description'),
    amount: get('amount'),
    vatRate: get('vatRate'),
    issueDate: get('issueDate'),
    dueDate: get('dueDate'),
    paid: get('paid'),
    note: get('note'),
  };
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const formData = await req.formData();
    const parsed = schema.safeParse(readForm(formData));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    if (!d.supplierCompanyId && !d.supplierName) {
      return NextResponse.json({ error: 'Vyplňte dodavatele.' }, { status: 400 });
    }

    const issueDate = toDate(d.issueDate);
    if (!issueDate) return NextResponse.json({ error: 'Neplatné datum dokladu.' }, { status: 400 });

    const amountExVatMinor = parseMoneyToMinor(d.amount);
    if (amountExVatMinor <= 0) {
      return NextResponse.json({ error: 'Vyplňte částku bez DPH.' }, { status: 400 });
    }

    // Priloha - nepovinna. Kdyz se nevejde, radeji to rekneme rovnou, nez aby
    // se doklad ulozil bez ni a nikdo si toho nevsiml.
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    const file = formData.get('attachment');
    if (file instanceof File && file.size > 0) {
      const result = await uploadExpenseAttachment(file);
      if (result && 'error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      if (result) {
        attachmentUrl = result.url;
        attachmentName = result.name;
      }
    }

    // Kurz CNB ke dni dokladu.
    const rate = await getRateForCurrency(d.currency, issueDate);

    const expense = await prisma.expense.create({
      data: {
        number: d.number || null,
        supplierCompanyId: d.supplierCompanyId || null,
        supplierName: d.supplierName || null,
        categoryId: d.categoryId || null,
        issuerCompanyId: d.issuerCompanyId || null,
        currency: d.currency,
        exchangeRate: rate?.rate ?? 1,
        exchangeRateDate: rate ? issueDate : null,
        description: d.description || null,
        amountExVatMinor,
        vatRate: d.vatRate,
        issueDate,
        dueDate: toDate(d.dueDate),
        paid: d.paid === 'true',
        paidAt: d.paid === 'true' ? new Date() : null,
        attachmentUrl,
        attachmentName,
        note: d.note || null,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/expenses selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
