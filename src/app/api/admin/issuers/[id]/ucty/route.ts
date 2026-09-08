import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { CURRENCIES } from '@/lib/doklady';

// Bankovni ucty vlastni firmy (zadani 8. 9. 2026 - vic uctu, kazdy ve sve mene).
const schema = z.object({
  label: z.string().trim().min(1, 'Vyplňte označení účtu.').max(80),
  accountNumber: z.string().trim().optional(),
  iban: z.string().trim().optional(),
  swift: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  currency: z.enum(CURRENCIES),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    if (!d.accountNumber && !d.iban) {
      return NextResponse.json({ error: 'Vyplňte číslo účtu nebo IBAN.' }, { status: 400 });
    }

    const issuer = await prisma.issuerCompany.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!issuer) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });

    // Vychozi ucet je jeden na menu.
    const existingInCurrency = await prisma.bankAccount.count({
      where: { issuerCompanyId: params.id, currency: d.currency },
    });
    const makeDefault = d.isDefault || existingInCurrency === 0;
    if (makeDefault) {
      await prisma.bankAccount.updateMany({
        where: { issuerCompanyId: params.id, currency: d.currency },
        data: { isDefault: false },
      });
    }

    const last = await prisma.bankAccount.findFirst({
      where: { issuerCompanyId: params.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const account = await prisma.bankAccount.create({
      data: {
        issuerCompanyId: params.id,
        label: d.label,
        accountNumber: d.accountNumber || null,
        iban: d.iban || null,
        swift: d.swift || null,
        bankName: d.bankName || null,
        currency: d.currency,
        isDefault: makeDefault,
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/issuers/[id]/ucty selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
