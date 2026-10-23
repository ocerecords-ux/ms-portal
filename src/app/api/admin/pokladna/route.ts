import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { smiDoPokladny } from '@/lib/pokladnaPristup';
import { zajistiPokladnu, zalozDoklad } from '@/lib/pokladnaServer';
import { SMERY } from '@/lib/pokladna';

/**
 * POKLADNA - zápis dokladu a nastavení (zadání 23. 10. 2026).
 *
 * Doklady, které si portál drží sám (hotově zaplacené výdaje), sem nechodí -
 * ty vznikají a mizí s výdajem, viz lib/pokladnaServer.ts.
 */
export const dynamic = 'force-dynamic';

const novy = z.object({
  issuerCompanyId: z.string().trim().min(1),
  smer: z.enum(['PRIJEM', 'VYDEJ']),
  /** YYYY-MM-DD - den, kdy peníze doopravdy přišly nebo odešly. */
  datum: z.string().trim().min(8),
  /** V haléřích, vždycky kladně - směr je vedle. */
  castkaMinor: z.number().int().min(1).max(1_000_000_000),
  vatRate: z.number().int().min(0).max(100).optional(),
  ucel: z.string().trim().min(1).max(300),
  protistrana: z.string().trim().max(200).nullable().optional(),
  poznamka: z.string().trim().max(500).nullable().optional(),
});

const nastaveni = z.object({
  issuerCompanyId: z.string().trim().min(1),
  nazev: z.string().trim().max(120).optional(),
  pocatecniStavMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  pocatecniDatum: z.string().trim().min(8).optional(),
  radaPrijem: z.string().trim().min(1).max(40).optional(),
  dalsiPrijem: z.number().int().min(1).max(1_000_000).optional(),
  radaVydej: z.string().trim().min(1).max(40).optional(),
  dalsiVydej: z.number().int().min(1).max(1_000_000).optional(),
});

function naDatum(value: string): Date | null {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session || !(await smiDoPokladny())) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = novy.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
        { status: 400 },
      );
    }

    const datum = naDatum(parsed.data.datum);
    if (!datum) return NextResponse.json({ error: 'Neplatné datum dokladu.' }, { status: 400 });

    const vysledek = await zalozDoklad(parsed.data.issuerCompanyId, {
      smer: parsed.data.smer === 'PRIJEM' ? SMERY.prijem : SMERY.vydej,
      datum,
      castkaMinor: parsed.data.castkaMinor,
      vatRate: parsed.data.vatRate ?? 0,
      ucel: parsed.data.ucel,
      protistrana: parsed.data.protistrana ?? null,
      poznamka: parsed.data.poznamka ?? null,
      kdoId: session.user.id ?? null,
      kdoJmeno: session.user.name ?? null,
    });

    if (!vysledek.ok) {
      return NextResponse.json({ error: vysledek.chyba || 'Uložení se nezdařilo.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/pokladna selhalo:', err);
    return NextResponse.json({ error: 'Doklad se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session || !(await smiDoPokladny())) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = nastaveni.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
        { status: 400 },
      );
    }
    const d = parsed.data;

    const pokladna = await zajistiPokladnu(d.issuerCompanyId);
    if (!pokladna) return NextResponse.json({ error: 'Pokladna se nenašla.' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (d.nazev !== undefined) data.nazev = d.nazev || null;
    if (d.pocatecniStavMinor !== undefined) data.pocatecniStavMinor = d.pocatecniStavMinor;
    if (d.radaPrijem !== undefined) data.radaPrijem = d.radaPrijem;
    if (d.dalsiPrijem !== undefined) data.dalsiPrijem = d.dalsiPrijem;
    if (d.radaVydej !== undefined) data.radaVydej = d.radaVydej;
    if (d.dalsiVydej !== undefined) data.dalsiVydej = d.dalsiVydej;
    if (d.pocatecniDatum !== undefined) {
      const datum = naDatum(d.pocatecniDatum);
      if (!datum) return NextResponse.json({ error: 'Neplatné datum.' }, { status: 400 });
      data.pocatecniDatum = datum;
    }

    await prisma.pokladna.update({ where: { id: pokladna.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/pokladna selhalo:', err);
    return NextResponse.json({ error: 'Nastavení se nepodařilo uložit.' }, { status: 500 });
  }
}
