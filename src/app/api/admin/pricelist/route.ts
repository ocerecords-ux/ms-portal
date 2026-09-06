import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { withVat } from '@/lib/priceList';

// Zalozeni polozky ceniku (zadani 5. 9. 2026).
const schema = z.object({
  name: z.string().trim().min(1, 'Název položky je povinný.').max(200),
  priceExVat: z.string().trim().optional(),
  priceIncVat: z.string().trim().optional(),
});

function toIntOrNull(v?: string): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const name = parsed.data.name;
    const exists = await prisma.priceListItem.findUnique({ where: { name } });
    if (exists) {
      return NextResponse.json({ error: 'Položka s tímto názvem už v ceníku je.' }, { status: 409 });
    }

    const priceExVat = toIntOrNull(parsed.data.priceExVat);
    // Cenu s DPH dopocitame, kdyz ji admin nevyplni - prepsat ji jde kdykoliv.
    const priceIncVat = toIntOrNull(parsed.data.priceIncVat) ?? (priceExVat != null ? withVat(priceExVat) : null);

    const last = await prisma.priceListItem.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });

    const item = await prisma.priceListItem.create({
      data: { name, priceExVat, priceIncVat, sortOrder: (last?.sortOrder ?? 0) + 10 },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/pricelist selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
