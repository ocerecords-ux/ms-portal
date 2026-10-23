import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { smiDoPokladny } from '@/lib/pokladnaPristup';

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

async function rucni(id: string) {
  const doklad = await prisma.pokladniDoklad
    .findUnique({ where: { id }, select: { id: true, expenseId: true } })
    .catch(() => null);
  if (!doklad) return { doklad: null, chyba: 'Doklad neexistuje.' as const };
  if (doklad.expenseId) {
    return {
      doklad: null,
      chyba: 'Tenhle doklad patří k výdaji — upravte ho ve Výdajích.' as const,
    };
  }
  return { doklad, chyba: null };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session || !(await smiDoPokladny())) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const { doklad, chyba } = await rucni(params.id);
    if (!doklad) return NextResponse.json({ error: chyba }, { status: chyba === 'Doklad neexistuje.' ? 404 : 409 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
        { status: 400 },
      );
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
      if (!datum) return NextResponse.json({ error: 'Neplatné datum dokladu.' }, { status: 400 });
      data.datum = datum;
    }

    await prisma.pokladniDoklad.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/pokladna/[id] selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session || !(await smiDoPokladny())) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const { doklad, chyba } = await rucni(params.id);
    if (!doklad) return NextResponse.json({ error: chyba }, { status: chyba === 'Doklad neexistuje.' ? 404 : 409 });

    await prisma.pokladniDoklad.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/pokladna/[id] selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}
