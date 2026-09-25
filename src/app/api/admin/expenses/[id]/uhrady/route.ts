import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { prepocitejUhradu } from '@/lib/uhradyVydajeServer';

/**
 * Úhrady jednoho výdaje (zadání 25. 9. 2026: „potřebuji u výdajů přidávat
 * částečnou úhradu, když budu třeba smlouvu nebo fakturu proplácet na
 * vícekrát, abych tam měl záznam, kolik ještě zbývá doplatit").
 *
 * Zapisuje se, co doopravdy odešlo z účtu — částka a den. Kolik zbývá, se
 * nikde neukládá: vždycky je to částka dokladu minus součet úhrad, takže se to
 * nemůže rozejít, ani když se částka dokladu později opraví.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  /** V haléřích a v měně dokladu. Nula ani mínus nedávají smysl. */
  castkaMinor: z.number().int().min(1).max(1_000_000_000),
  /** YYYY-MM-DD — den, kdy peníze odešly. */
  datum: z.string().trim().min(8),
  zpusob: z.enum(['CARD', 'CASH', 'TRANSFER']).optional(),
  poznamka: z.string().trim().max(300).nullable().optional(),
});

function naDatum(value: string): Date | null {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const datum = naDatum(parsed.data.datum);
    if (!datum) return NextResponse.json({ error: 'Neplatné datum úhrady.' }, { status: 400 });

    const doklad = await prisma.expense.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!doklad) return NextResponse.json({ error: 'Doklad neexistuje.' }, { status: 404 });

    await prisma.uhradaVydaje.create({
      data: {
        expenseId: params.id,
        castkaMinor: parsed.data.castkaMinor,
        datum,
        zpusob: parsed.data.zpusob ?? 'TRANSFER',
        poznamka: parsed.data.poznamka || null,
        kdoId: session.user.id ?? null,
        kdoJmeno: session.user.name ?? null,
      },
    });

    const stav = await prepocitejUhradu(params.id);
    return NextResponse.json({ ok: true, ...stav });
  } catch (err) {
    console.error('POST /api/admin/expenses/[id]/uhrady selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Úhradu se nepodařilo zapsat (${message}).` }, { status: 500 });
  }
}
