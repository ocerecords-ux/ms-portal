import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nastavZapnuti } from '@/lib/oznameniServer';

/**
 * Nastavení měsíčního přehledu zvukařům - kdy odchází a co v něm je
 * (zadání 21. 9. 2026). Vypínač celé zprávy je sdílený se Zprávami portálu.
 */
const schema = z.object({
  den: z.number().int().min(1).max(28),
  castky: z.boolean(),
  druhy: z.boolean(),
  projekty: z.boolean(),
  bonusy: z.boolean(),
  poznamka: z.string().max(2000).nullable(),
  zapnuto: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatné nastavení.' }, { status: 400 });
  const d = parsed.data;
  const kdo = session.user?.name || session.user?.email || null;

  try {
    const data = {
      den: d.den,
      castky: d.castky,
      druhy: d.druhy,
      projekty: d.projekty,
      bonusy: d.bonusy,
      poznamka: d.poznamka?.trim() || null,
      zmenilJmeno: kdo,
    };
    await prisma.nastaveniPrehleduZvukaru.upsert({
      where: { id: 'vychozi' },
      create: { id: 'vychozi', ...data },
      update: data,
    });
    await nastavZapnuti('MESICNI_PREHLED', d.zapnuto, kdo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Uložení nastavení přehledu zvukařům selhalo:', err);
    return NextResponse.json({ error: 'Nastavení se nepodařilo uložit.' }, { status: 500 });
  }
}
