import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { CURRENCIES } from '@/lib/doklady';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

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
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      // Věta od `zod` jde první, a když žádná není, jde klíč (vzor z dávky 7s).
      return parsed.error.issues[0]?.message
        ? NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
        : odpovedChyby('chybaApi.neplatnaData', 400);
    }
    const d = parsed.data;

    if (!d.accountNumber && !d.iban) {
      return odpovedChyby('chybaApi.chybiCisloUctuNeboIban', 400);
    }

    const issuer = await prisma.issuerCompany.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!issuer) return odpovedChyby('chybaApi.firmaNenalezena', 404);

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
    // Technická zpráva z výjimky jde do značky jako hodnota (dávka 7q); když
    // žádná není, odejde věta bez ní - 'Neznámá chyba.' ve značce by zůstala
    // česky i v anglické větě.
    const message = err instanceof Error ? err.message : '';
    return message
      ? odpovedChybyS('chybaApi.ulozeniNezdariloS', { zprava: message }, 500)
      : odpovedChyby('chybaApi.ulozeniNezdarilo', 500);
  }
}
