import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

// Oznaceni faktury jako uhrazene, pripadne zruseni uhrady (zadani 6. 9. 2026).
// Zatim rucne - az bude napojena Air Bank, bude se to parovat automaticky
// podle variabilniho symbolu a castky.
const schema = z.object({
  paid: z.boolean(),
  paidAt: z.string().trim().optional(),
  paidAmountMinor: z.number().int().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return odpovedChyby('chybaApi.neplatnaData', 400);
    }
    const d = parsed.data;

    const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!invoice) return odpovedChyby('chybaApi.fakturaNenalezena', 404);

    if (!d.paid) {
      await prisma.invoice.update({
        where: { id: params.id },
        data: { status: 'SENT', paidAt: null, paidAmountMinor: null },
      });
      return NextResponse.json({ ok: true });
    }

    let paidAt = new Date();
    if (d.paidAt) {
      const parsedDate = new Date(`${d.paidAt}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime())) {
        return odpovedChyby('chybaApi.neplatneDatumUhrady', 400);
      }
      paidAt = parsedDate;
    }

    await prisma.invoice.update({
      where: { id: params.id },
      data: { status: 'PAID', paidAt, paidAmountMinor: d.paidAmountMinor ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/invoices/[id]/uhrada selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return odpovedChybyS('chybaApi.ulozeniNezdariloS', { zprava: message }, 500);
  }
}
