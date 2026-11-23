import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { smiDoPokladny } from '@/lib/pokladnaPristup';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * ÚPRAVA A SMAZÁNÍ JEDNOHO POKLADNÍHO DOKLADU (23. 10. 2026).
 *
 * JEN U RUČNĚ ZAPSANÝCH. Doklad, který vznikl z hotově zaplaceného výdaje,
 * si portál drží sám - mění se úhrada u výdaje a pokladna se srovná. Kdyby
 * se dal přepsat i tady, měla by jedna stokoruna dvě různé pravdy.
 *
 * ČÍSLO SE NEMĚNÍ. V pokladní knize je číslo dokladu to jediné, podle čeho
 * se papír v šanonu najde.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  datum: z.string().trim().min(8).optional(),
  castkaMinor: z.number().int().min(1).max(1_000_000_000).optional(),
  vatRate: z.number().int().min(0).max(100).optional(),
  ucel: z.string().trim().min(1).max(300).optional(),
  protistrana: z.string().trim().max(200).nullable().optional(),
  poznamka: z.string().trim().max(500).nullable().optional(),
});

function naDatum(value: string): Date | null {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Důvod chodí KLÍČEM do slovníku (dávka 7ad) - stav se podle něj pozná
 * stejně jako dřív podle věty, takže 404 a 409 zůstávají, kde byly.
 */
async function rucni(id: string) {
  const doklad = await prisma.pokladniDoklad
    .findUnique({ where: { id }, select: { id: true, expenseId: true } })
    .catch(() => null);
  if (!doklad) return { doklad: null, klic: 'chybaApi.dokladNeexistuje' as const };
  if (doklad.expenseId) {
    return { doklad: null, klic: 'chybaApi.pokladniDokladZVydaje' as const };
  }
  return { doklad, klic: null };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session || !(await smiDoPokladny())) {
      return odpovedChyby('chybaApi.bezOpravneni', 403);
    }

    const { doklad, klic } = await rucni(params.id);
    if (!doklad) return odpovedChyby(klic, klic === 'chybaApi.dokladNeexistuje' ? 404 : 409);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      // Věta od `zod` jde první, a když žádná není, jde klíč (vzor z dávky 7s).
      return parsed.error.issues[0]?.message
        ? NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
        : odpovedChyby('chybaApi.neplatnaData', 400);
    }
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.castkaMinor !== undefined) data.castkaMinor = Math.abs(d.castkaMinor);
    if (d.vatRate !== undefined) data.vatRate = d.vatRate;
    if (d.ucel !== undefined) data.ucel = d.ucel;
    if (d.protistrana !== undefined) data.protistrana = d.protistrana || null;
    if (d.poznamka !== undefined) data.poznamka = d.poznamka || null;
    if (d.datum !== undefined) {
      const datum = naDatum(d.datum);
      if (!datum) return odpovedChyby('chybaApi.neplatneDatumDokladu', 400);
      data.datum = datum;
    }

    await prisma.pokladniDoklad.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/pokladna/[id] selhalo:', err);
    return odpovedChyby('chybaApi.ulozeniNezdarilo', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session || !(await smiDoPokladny())) {
      return odpovedChyby('chybaApi.bezOpravneni', 403);
    }

    const { doklad, klic } = await rucni(params.id);
    if (!doklad) return odpovedChyby(klic, klic === 'chybaApi.dokladNeexistuje' ? 404 : 409);

    await prisma.pokladniDoklad.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/pokladna/[id] selhalo:', err);
    return odpovedChyby('chybaApi.smazaniNezdarilo', 500);
  }
}
