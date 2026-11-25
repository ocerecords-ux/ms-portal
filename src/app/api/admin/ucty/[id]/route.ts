import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

// Uprava a smazani bankovniho uctu vlastni firmy.
const schema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  accountNumber: z.string().trim().optional(),
  iban: z.string().trim().optional(),
  swift: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

    const account = await prisma.bankAccount.findUnique({ where: { id: params.id } });
    if (!account) return odpovedChyby('chybaApi.ucetNenalezen', 404);

    const data: Record<string, unknown> = {};
    if (d.label !== undefined) data.label = d.label;
    if (d.accountNumber !== undefined) data.accountNumber = d.accountNumber || null;
    if (d.iban !== undefined) data.iban = d.iban || null;
    if (d.swift !== undefined) data.swift = d.swift || null;
    if (d.bankName !== undefined) data.bankName = d.bankName || null;

    if (d.isDefault) {
      // Vychozi ucet je jeden na menu u dane firmy.
      await prisma.bankAccount.updateMany({
        where: { issuerCompanyId: account.issuerCompanyId, currency: account.currency },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (d.isDefault === false) {
      data.isDefault = false;
    }

    const updated = await prisma.bankAccount.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/admin/ucty/[id] selhalo:', err);
    // Technická zpráva z výjimky jde do značky jako hodnota (dávka 7q); když
    // žádná není, odejde věta bez ní - 'Neznámá chyba.' ve značce by zůstala
    // česky i v anglické větě.
    const message = err instanceof Error ? err.message : '';
    return message
      ? odpovedChybyS('chybaApi.ulozeniNezdariloS', { zprava: message }, 500)
      : odpovedChyby('chybaApi.ulozeniNezdarilo', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    await prisma.bankAccount.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/ucty/[id] selhalo:', err);
    // Technická zpráva z výjimky jde do značky jako hodnota (dávka 7q); když
    // žádná není, odejde věta bez ní - 'Neznámá chyba.' ve značce by zůstala
    // česky i v anglické větě.
    const message = err instanceof Error ? err.message : '';
    return message
      ? odpovedChybyS('chybaApi.smazaniNezdariloS', { zprava: message }, 500)
      : odpovedChyby('chybaApi.smazaniNezdarilo', 500);
  }
}
