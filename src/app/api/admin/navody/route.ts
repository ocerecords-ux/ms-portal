import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { hledaciText } from '@/lib/navody';
import { volnySlug } from '@/lib/navodyServer';

/**
 * ZALOŽENÍ NÁVODU (zadání 16. 9. 2026).
 *
 * Píše je Zuzo-labuzo, čte je celý tým — proto jen tahle routa je pod
 * /api/admin, zatímco čtení jde přes stránky portálu.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(2, 'Napište název návodu.').max(200),
  perex: z.string().trim().max(300).optional().default(''),
  kategorie: z.string().trim().max(60).optional().default('Ostatní'),
  obsah: z.string().max(200_000).optional().default(''),
  poradi: z.number().int().min(0).max(9999).optional().default(100),
  zverejneno: z.boolean().optional().default(false),
  proRole: z.array(z.string().max(20)).max(10).optional().default([]),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    const navod = await prisma.navod.create({
      data: {
        slug: await volnySlug(d.nazev),
        nazev: d.nazev,
        perex: d.perex || null,
        kategorie: d.kategorie || 'Ostatní',
        obsah: d.obsah,
        hledaci: hledaciText({ nazev: d.nazev, perex: d.perex, obsah: d.obsah }),
        poradi: d.poradi,
        zverejneno: d.zverejneno,
        proRole: d.proRole,
        autorId: session.user.id,
      },
      select: { id: true, slug: true },
    });
    return NextResponse.json(navod, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/navody selhalo:', err);
    return NextResponse.json({ error: 'Návod se nepodařilo založit.' }, { status: 500 });
  }
}
