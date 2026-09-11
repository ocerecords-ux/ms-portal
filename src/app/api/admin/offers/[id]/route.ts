import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { CURRENCIES } from '@/lib/doklady';
import { resolveProject } from '@/lib/projectOptions';

// Uprava nabidky (zadani 6. 9. 2026). Polozky se posilaji vzdy cele - editor
// s nimi pracuje jako s jednim celkem, takze je jednodussi je prepsat nez
// dohledavat, co presne se zmenilo.
const itemSchema = z.object({
  description: z.string().trim().min(1, 'Vyplňte popis položky.').max(300),
  quantity: z.number().finite().min(0),
  unit: z.string().trim().max(20).optional(),
  unitPriceMinor: z.number().int(),
  vatRate: z.number().int().min(0).max(100),
});

const schema = z.object({
  issuerCompanyId: z.string().trim().min(1).optional(),
  companyId: z.string().trim().min(1).optional(),
  currency: z.enum(CURRENCIES).optional(),
  issueDate: z.string().trim().min(8).optional(),
  validUntil: z.string().trim().nullable().optional(),
  subject: z.string().trim().max(200).optional(),
  note: z.string().trim().max(3000).optional(),
  caflouProjectId: z.string().trim().nullable().optional(),
  // Jazyk vytistene nabidky (zadani 10. 9. 2026).
  jazyk: z.enum(['CS', 'EN']).optional(),
  items: z.array(itemSchema).max(100).optional(),
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

    const offer = await prisma.offer.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
    if (!offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    if (offer.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Schválenou nabídku už nejde měnit — klient ji odsouhlasil v této podobě.' },
        { status: 409 },
      );
    }

    const data: Record<string, unknown> = {};
    if (d.issuerCompanyId !== undefined) data.issuerCompanyId = d.issuerCompanyId;
    if (d.companyId !== undefined) data.companyId = d.companyId;
    if (d.currency !== undefined) data.currency = d.currency;
    if (d.subject !== undefined) data.subject = d.subject || null;
    if (d.note !== undefined) data.note = d.note || null;
    if (d.jazyk !== undefined) data.jazyk = d.jazyk;
    if (d.caflouProjectId !== undefined) {
      const projekt = await resolveProject(d.caflouProjectId);
      data.caflouProjectId = projekt.caflouProjectId;
      data.projectName = projekt.projectName;
    }

    if (d.issueDate !== undefined) {
      const date = toDate(d.issueDate);
      if (!date) return NextResponse.json({ error: 'Neplatné datum vystavení.' }, { status: 400 });
      data.issueDate = date;
    }
    if (d.validUntil !== undefined) {
      if (!d.validUntil) {
        data.validUntil = null;
      } else {
        const date = toDate(d.validUntil);
        if (!date) return NextResponse.json({ error: 'Neplatná platnost do.' }, { status: 400 });
        data.validUntil = date;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.offer.update({ where: { id: params.id }, data });
      if (d.items) {
        await tx.offerItem.deleteMany({ where: { offerId: params.id } });
        if (d.items.length > 0) {
          await tx.offerItem.createMany({
            data: d.items.map((item, index) => ({
              offerId: params.id,
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
    console.error('PATCH /api/admin/offers/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const offer = await prisma.offer.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!offer) return NextResponse.json({ error: 'Nabídka nenalezena.' }, { status: 404 });
    if (offer.status === 'APPROVED') {
      return NextResponse.json({ error: 'Schválenou nabídku nelze smazat.' }, { status: 409 });
    }

    await prisma.offer.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/offers/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
