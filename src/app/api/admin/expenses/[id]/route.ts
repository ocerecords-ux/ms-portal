import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { resolveProject } from '@/lib/projectOptions';
import { getRateForCurrency } from '@/lib/cnb';
import { CURRENCIES } from '@/lib/doklady';

// Uprava a smazani prijateho dokladu. Prepinac uhrazeno/neuhrazeno jde taky
// tudy - je to jen jedno pole navic.
const schema = z.object({
  number: z.string().trim().max(60).nullable().optional(),
  supplierCompanyId: z.string().trim().nullable().optional(),
  supplierName: z.string().trim().max(200).nullable().optional(),
  categoryId: z.string().trim().nullable().optional(),
  caflouProjectId: z.string().trim().nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  amountExVatMinor: z.number().int().min(0).optional(),
  vatRate: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().trim().nullable().optional(),
  paid: z.boolean().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  // Doklad ze schranky (zadani 12. 9. 2026): ucetni ho prekontroluje a timhle
  // ho zaradi mezi vydaje. Zaroven u nej jde opravit to, co se u rucne
  // zadaneho dokladu menit nemuselo - datum, menu i zpusob uhrady vycetl
  // z prilohy model a muze se seknout.
  stav: z.enum(['NEZARAZENY', 'ZARAZENY']).optional(),
  issueDate: z.string().trim().optional(),
  currency: z.enum(CURRENCIES).optional(),
  paymentMethod: z.enum(['CARD', 'CASH', 'TRANSFER']).optional(),
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

    const data: Record<string, unknown> = {};
    if (d.number !== undefined) data.number = d.number || null;
    if (d.supplierCompanyId !== undefined) data.supplierCompanyId = d.supplierCompanyId || null;
    if (d.supplierName !== undefined) data.supplierName = d.supplierName || null;
    if (d.categoryId !== undefined) data.categoryId = d.categoryId || null;
    if (d.caflouProjectId !== undefined) {
      const projekt = await resolveProject(d.caflouProjectId);
      data.caflouProjectId = projekt.caflouProjectId;
      data.projectName = projekt.projectName;
    }
    if (d.description !== undefined) data.description = d.description || null;
    if (d.amountExVatMinor !== undefined) data.amountExVatMinor = d.amountExVatMinor;
    if (d.vatRate !== undefined) data.vatRate = d.vatRate;
    if (d.note !== undefined) data.note = d.note || null;

    if (d.dueDate !== undefined) {
      if (!d.dueDate) {
        data.dueDate = null;
      } else {
        const date = toDate(d.dueDate);
        if (!date) return NextResponse.json({ error: 'Neplatné datum splatnosti.' }, { status: 400 });
        data.dueDate = date;
      }
    }

    if (d.paid !== undefined) {
      data.paid = d.paid;
      data.paidAt = d.paid ? new Date() : null;
    }

    if (d.stav !== undefined) data.stav = d.stav;
    if (d.paymentMethod !== undefined) data.paymentMethod = d.paymentMethod;

    if (d.issueDate !== undefined) {
      const date = toDate(d.issueDate);
      if (!date) return NextResponse.json({ error: 'Neplatné datum dokladu.' }, { status: 400 });
      data.issueDate = date;
    }

    // S menou se meni i kurz - jinak by u dokladu zustal kurz predchozi meny
    // a prepocet do korun by lhal.
    if (d.currency !== undefined) {
      data.currency = d.currency;
      const kDatu = (data.issueDate as Date | undefined) ?? new Date();
      const kurz = await getRateForCurrency(d.currency, kDatu);
      if (kurz) {
        data.exchangeRate = kurz.rate;
        data.exchangeRateDate = new Date(`${kurz.date}T00:00:00.000Z`);
      }
    }

    await prisma.expense.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/expenses/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/expenses/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
