import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { podepsanyUploadObaluHudby } from '@/lib/storage';

/** Adresa na nahrání obalu z metadat; token je jediný klíč. */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const vyzva = await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { id: true } })
    .catch(() => null);
  if (!vyzva) return NextResponse.json({ error: 'Odkaz neplatí.' }, { status: 404 });

  const podpis = await podepsanyUploadObaluHudby('obal');
  if (!podpis) return NextResponse.json({ error: 'Úložiště není nastavené.' }, { status: 503 });
  return NextResponse.json(podpis);
}
