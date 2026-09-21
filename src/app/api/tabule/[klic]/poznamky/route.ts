import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { studioPodleKlice } from '@/lib/tabuleServer';

/**
 * Poznámky na tabuli ve studiu (21. 9. 2026). POST přidá, PATCH { id }
 * odškrtne. Poznámka zůstává, dokud ji někdo neodškrtne.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { klic: string } }) {
  const studio = await studioPodleKlice(params.klic);
  if (!studio) return NextResponse.json({ error: 'Tabule neexistuje.' }, { status: 404 });
  const telo = (await req.json().catch(() => null)) as { text?: unknown; autor?: unknown } | null;
  const text = typeof telo?.text === 'string' ? telo.text.trim().slice(0, 500) : '';
  const autor = typeof telo?.autor === 'string' ? telo.autor.trim().slice(0, 60) || null : null;
  if (!text) return NextResponse.json({ error: 'Poznámka je prázdná.' }, { status: 400 });
  const p = await prisma.studioPoznamka.create({ data: { studioId: studio.id, text, autor } });
  return NextResponse.json({ ok: true, id: p.id });
}

export async function PATCH(req: NextRequest, { params }: { params: { klic: string } }) {
  const studio = await studioPodleKlice(params.klic);
  if (!studio) return NextResponse.json({ error: 'Tabule neexistuje.' }, { status: 404 });
  const telo = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof telo?.id === 'string' ? telo.id : '';
  await prisma.studioPoznamka.updateMany({
    where: { id, studioId: studio.id, hotovoAt: null },
    data: { hotovoAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
