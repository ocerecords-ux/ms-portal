import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';

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
    if (!session) return odpovedChyby('chybaApi.bezOpravneni', 403);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      // Věta od `zod` jde první, a když žádná není, jde klíč (vzor z dávky 7s).
      return parsed.error.issues[0]?.message
        ? NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
        : odpovedChyby('chybaApi.neplatnaData', 400);
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
    // Technická zpráva z výjimky jde do značky jako hodnota (dávka 7q); když
    // žádná není, odejde věta bez ní - 'Neznámá chyba.' ve značce by zůstala
    // česky i v anglické větě.
    const message = err instanceof Error ? err.message : '';
    return message
      ? odpovedChybyS('chybaApi.ulozeniNezdariloS', { zprava: message }, 500)
      : odpovedChyby('chybaApi.ulozeniNezdarilo', 500);
  }
}
