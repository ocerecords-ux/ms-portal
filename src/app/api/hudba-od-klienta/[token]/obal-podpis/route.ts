import { NextRequest, NextResponse } from 'next/server';

import { odpovedChyby } from '@/lib/chybyApi';
import { prisma } from '@/lib/db';
import { podepsanyUploadObaluHudby } from '@/lib/storage';

/** Adresa na nahrání obalu z metadat; token je jediný klíč. */
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const vyzva = await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { id: true } })
    .catch(() => null);
  if (!vyzva) return odpovedChyby('chybaApi.odkazNeplati', 404);

  const podpis = await podepsanyUploadObaluHudby('obal');
  if (!podpis) return odpovedChyby('chybaApi.uloznisteNeniNastavene', 503);
  return NextResponse.json(podpis);
}
