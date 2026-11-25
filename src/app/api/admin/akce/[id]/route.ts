import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { smiSpravovatAkce } from '@/lib/akceServer';
import { odpovedChyby } from '@/lib/chybyApi';

/** Úprava akce - viz ../route.ts. */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(200).optional(),
  kdy: z.string().trim().max(40).nullable().optional(),
  misto: z.string().trim().max(300).nullable().optional(),
  text: z.string().trim().max(8000).nullable().optional(),
  odpovedDo: z.string().trim().max(40).nullable().optional(),
});

function naDatum(hodnota: string | null | undefined): Date | null {
  if (!hodnota) return null;
  const d = new Date(hodnota.length <= 10 ? `${hodnota}T00:00:00` : hodnota);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await smiSpravovatAkce(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  const d = parsed.data;

  try {
    await prisma.akce.update({
      where: { id: params.id },
      data: {
        ...(d.nazev !== undefined ? { nazev: d.nazev } : {}),
        ...(d.kdy !== undefined ? { kdy: naDatum(d.kdy) } : {}),
        ...(d.misto !== undefined ? { misto: d.misto || null } : {}),
        ...(d.text !== undefined ? { text: d.text || null } : {}),
        ...(d.odpovedDo !== undefined ? { odpovedDo: naDatum(d.odpovedDo) } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/akce/[id] selhalo:', err);
    return odpovedChyby('chybaApi.ulozeniNepodarilo', 500);
  }
}
