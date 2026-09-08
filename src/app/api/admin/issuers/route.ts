import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// "Moje firmy" - vlastni fakturacni jednotky (zadani 6. 9. 2026). Spravuje je
// jen Zuzo-labuzo.
const schema = z.object({
  name: z.string().trim().min(1, 'Název firmy je povinný.').max(200),
  ic: z.string().trim().optional(),
  dic: z.string().trim().optional(),
  vatPayer: z.boolean().optional(),
  addressStreet: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressZip: z.string().trim().optional(),
  addressCountry: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    // Prvni zalozena firma je rovnou vychozi - at neni potreba na to myslet.
    const existing = await prisma.issuerCompany.count();

    const issuer = await prisma.issuerCompany.create({
      data: {
        name: data.name,
        ic: data.ic || null,
        dic: data.dic || null,
        vatPayer: data.vatPayer ?? true,
        addressStreet: data.addressStreet || null,
        addressCity: data.addressCity || null,
        addressZip: data.addressZip || null,
        addressCountry: data.addressCountry || 'CZ',
        email: data.email || null,
        phone: data.phone || null,
        isDefault: existing === 0,
      },
    });

    return NextResponse.json(issuer, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/issuers selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
