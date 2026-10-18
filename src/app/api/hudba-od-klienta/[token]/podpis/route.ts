import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { odpovedChyby } from '@/lib/chybyApi';
import { prisma } from '@/lib/db';
import { dropboxNastaven } from '@/lib/dropbox';
import { pripravNahrani } from '@/lib/hudbaProjektuServer';

/**
 * ADRESA, NA KTEROU KLIENT POŠLE SOUBOR (17. 10. 2026).
 *
 * Veřejné, ale jen na jeden projekt - token je jediný klíč. CESTU URČUJE
 * VÝHRADNĚ SERVER: kdyby ji posílal prohlížeč, dala by se jí přepsat cizí
 * nahrávka kdekoliv v Dropboxu.
 */
export const dynamic = 'force-dynamic';

/** Nad tohle už to není hudba ke knize, ale omyl. */
const MAX_BYTES = 300 * 1024 * 1024;

const schema = z.object({
  nazev: z.string().trim().min(1).max(255),
  velikost: z.number().int().positive().max(MAX_BYTES, 'Soubor je moc velký.'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { caflouProjectId: true } })
    .catch(() => null)) as { caflouProjectId: string } | null;
  if (!vyzva) return odpovedChyby('chybaApi.odkazNeplati', 404);

  if (!dropboxNastaven()) {
    return odpovedChyby('chybaApi.nahravaniNejde', 503);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná data.' },
      { status: 400 },
    );
  }

  const meta = (await prisma.projectMeta
    .findUnique({ where: { caflouProjectId: vyzva.caflouProjectId }, select: { name: true } })
    .catch(() => null)) as { name: string | null } | null;

  const pripraveno = await pripravNahrani({
    nazevProjektu: meta?.name ?? vyzva.caflouProjectId,
    nazevSouboru: parsed.data.nazev,
  });
  if ('chyba' in pripraveno) {
    return NextResponse.json({ error: pripraveno.chyba, klic: pripraveno.chybaKlic }, { status: 502 });
  }
  return NextResponse.json(pripraveno);
}
