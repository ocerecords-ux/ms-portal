import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { oznacOdeslane, sestavNewsletter } from '@/lib/novinkyServer';

/**
 * MĚSÍČNÍ PŘEHLED DO NEWSLETTERU (zadání 17. 10. 2026). Sestaví text pro jedno
 * publikum a jeden měsíc; druhým voláním se novinky označí jako odeslané, aby
 * se příští měsíc neposlaly znovu.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  mesic: z.string().regex(/^\d{4}-\d{2}$/),
  publikum: z.string().trim().min(1).max(30),
  vcetneOdeslanych: z.boolean().optional(),
});

const schemaOdeslano = z.object({ idcka: z.array(z.string().trim().min(1)).max(500) });

async function straz() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN';
}

export async function POST(req: NextRequest) {
  if (!(await straz())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const data = await req.json().catch(() => null);

  const oznaceni = schemaOdeslano.safeParse(data);
  if (oznaceni.success) {
    const pocet = await oznacOdeslane(oznaceni.data.idcka);
    return NextResponse.json({ oznaceno: pocet });
  }

  const telo = schema.safeParse(data);
  if (!telo.success) return NextResponse.json({ error: 'Nesprávná data.' }, { status: 400 });
  const newsletter = await sestavNewsletter(
    telo.data.mesic,
    telo.data.publikum,
    telo.data.vcetneOdeslanych === true,
  );
  return NextResponse.json({ newsletter });
}
