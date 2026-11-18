import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { posluchacZCookie } from '@/lib/preposlechPristup';
import { projektPodleTokenu, zakladPortalu } from '@/lib/preposlechOdkaz';
import { zapisPodnetZvenci } from '@/lib/pripominkyServer';

/**
 * Podnět k AudioTaggeru od klienta (zadání 18. 11. 2026). Otevřená routa -
 * platí token z mailu, nic jiného po přeposlouchávači chtít nemůžeme.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  text: z.string().trim().min(3).max(4000),
  /** Když se člověk nepředstavil v Posluchačích, může adresu napsat tady. */
  email: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const caflouProjectId = await projektPodleTokenu(params.token);
  if (!caflouProjectId) {
    return NextResponse.json({ error: 'Odkaz už neplatí.' }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Napište prosím pár slov.' }, { status: 400 });
  }

  const ja = await posluchacZCookie(caflouProjectId);
  const projekt = await prisma.projectMeta
    .findUnique({ where: { caflouProjectId }, select: { name: true } })
    .catch(() => null);

  const ulozeno = await zapisPodnetZvenci({
    text: parsed.data.text,
    email: ja?.email ?? parsed.data.email ?? null,
    jmeno: ja?.jmeno ?? null,
    odkud: `${zakladPortalu()}/projekty/${caflouProjectId}${projekt?.name ? ` — ${projekt.name}` : ''}`,
  });
  if (!ulozeno) {
    return NextResponse.json({ error: 'Podnět se nepodařilo uložit.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
