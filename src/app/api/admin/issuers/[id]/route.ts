import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { CURRENCIES } from '@/lib/doklady';

// Uprava vlastni fakturacni firmy vcetne ciselnych rad (zadani 6. 9. 2026).
const schema = z.object({
  name: z.string().trim().min(1, 'Název firmy je povinný.').max(200).optional(),
  ic: z.string().trim().optional(),
  dic: z.string().trim().optional(),
  vatPayer: z.boolean().optional(),
  addressStreet: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressZip: z.string().trim().optional(),
  addressCountry: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  invoiceNumberFormat: z.string().trim().min(1).max(60).optional(),
  invoiceNextNumber: z.union([z.string(), z.number()]).optional(),
  offerNumberFormat: z.string().trim().min(1).max(60).optional(),
  offerNextNumber: z.union([z.string(), z.number()]).optional(),
  defaultCurrency: z.enum(CURRENCIES).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

function toPositiveInt(v: string | number | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/\s/g, ''), 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
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

    // Format musi obsahovat poradove cislo, jinak by druhy doklad narazil na
    // unikatni cislo a nesel ulozit.
    for (const format of [d.invoiceNumberFormat, d.offerNumberFormat]) {
      if (format && !/\{N+\}/.test(format)) {
        return NextResponse.json(
          { error: 'Formát musí obsahovat pořadové číslo, například {NNN}.' },
          { status: 400 },
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.ic !== undefined) data.ic = d.ic || null;
    if (d.dic !== undefined) data.dic = d.dic || null;
    if (d.vatPayer !== undefined) data.vatPayer = d.vatPayer;
    if (d.addressStreet !== undefined) data.addressStreet = d.addressStreet || null;
    if (d.addressCity !== undefined) data.addressCity = d.addressCity || null;
    if (d.addressZip !== undefined) data.addressZip = d.addressZip || null;
    if (d.addressCountry !== undefined) data.addressCountry = d.addressCountry || 'CZ';
    if (d.email !== undefined) data.email = d.email || null;
    if (d.phone !== undefined) data.phone = d.phone || null;
    if (d.invoiceNumberFormat !== undefined) data.invoiceNumberFormat = d.invoiceNumberFormat;
    if (d.offerNumberFormat !== undefined) data.offerNumberFormat = d.offerNumberFormat;
    if (d.defaultCurrency !== undefined) data.defaultCurrency = d.defaultCurrency;
    if (d.active !== undefined) data.active = d.active;

    const invoiceNext = toPositiveInt(d.invoiceNextNumber);
    if (invoiceNext !== undefined) data.invoiceNextNumber = invoiceNext;
    const offerNext = toPositiveInt(d.offerNextNumber);
    if (offerNext !== undefined) data.offerNextNumber = offerNext;

    // Vychozi firma muze byt jen jedna.
    if (d.isDefault) {
      await prisma.issuerCompany.updateMany({ where: { NOT: { id: params.id } }, data: { isDefault: false } });
      data.isDefault = true;
    } else if (d.isDefault === false) {
      data.isDefault = false;
    }

    const issuer = await prisma.issuerCompany.update({ where: { id: params.id }, data });
    return NextResponse.json(issuer);
  } catch (err) {
    console.error('PATCH /api/admin/issuers/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    // Firmu s vystavenymi doklady nemazeme - jen ji vyradime z nabidky, aby
    // stare doklady zustaly cele.
    const used = await prisma.offer.count({ where: { issuerCompanyId: params.id } });
    if (used > 0) {
      await prisma.issuerCompany.update({ where: { id: params.id }, data: { active: false } });
      return NextResponse.json({ ok: true, deactivatedInsteadOfDeleted: true, usedByOffers: used });
    }

    await prisma.issuerCompany.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/issuers/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
