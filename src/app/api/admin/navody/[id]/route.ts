import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { hledaciText } from '@/lib/navody';
import { volnySlug } from '@/lib/navodyServer';

/**
 * ÚPRAVA A SMAZÁNÍ NÁVODU (zadání 16. 9. 2026).
 *
 * ADRESA SE MĚNÍ JEN S NÁZVEM. Kdo si na návod uložil odkaz, má ho pak
 * neplatný — proto se slug přepočítá až ve chvíli, kdy se změní název, ne
 * při každém uložení.
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    const stary = await prisma.navod.findUnique({ where: { id: params.id } });
    if (!stary) return NextResponse.json({ error: 'Návod nenalezen.' }, { status: 404 });

    const navod = await prisma.navod.update({
      where: { id: params.id },
      data: {
        nazev: d.nazev,
        perex: d.perex || null,
        kategorie: d.kategorie || 'Ostatní',
        obsah: d.obsah,
        hledaci: hledaciText({ nazev: d.nazev, perex: d.perex, obsah: d.obsah }),
        poradi: d.poradi,
        zverejneno: d.zverejneno,
        proRole: d.proRole,
        autorId: session.user.id,
        ...(d.nazev !== stary.nazev ? { slug: await volnySlug(d.nazev, params.id) } : {}),
      },
      select: { id: true, slug: true },
    });
    return NextResponse.json(navod);
  } catch (err) {
    console.error('PATCH /api/admin/navody/[id] selhalo:', err);
    return NextResponse.json({ error: 'Návod se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    await prisma.navod.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/navody/[id] selhalo:', err);
    return NextResponse.json({ error: 'Návod se nepodařilo smazat.' }, { status: 500 });
  }
}
