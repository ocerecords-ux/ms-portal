import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { smiPoslatPribeh } from '@/lib/pribehyServer';
import { MAX_VIDEO_BYTES, POVOLENE_TYPY, maxProTyp, velikostVMB } from '@/lib/pribehy';
import { isStorageConfigured, podepsanyUploadPribehu } from '@/lib/storage';

/**
 * ADRESA, NA KTEROU PROHLÍŽEČ POŠLE PŘÍBĚH (zadání 6. 10. 2026).
 *
 * Soubor NEJDE přes portál - funkce na Vercelu mají strop na velikost
 * požadavku kolem 4,5 MB a patnáctisekundové video z telefonu ho přeleze.
 * Prohlížeč si tu vyžádá podepsanou adresu, nahraje soubor rovnou do
 * úložiště a teprve pak portál příběh zapíše (viz /api/site/pribehy).
 *
 * Klíč si určuje výhradně server - kdyby ho posílal prohlížeč, dal by se jím
 * přepsat cizí soubor.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(255),
  typ: z.string().trim().max(160),
  velikost: z.number().int().positive().max(MAX_VIDEO_BYTES),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  if (!(await smiPoslatPribeh({ id: session.user.id, role: session.user.role }))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'Příběhy zatím nejdou - portál nemá nastavené úložiště souborů.' },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatný soubor.' }, { status: 400 });
  }
  const { nazev, typ, velikost } = parsed.data;

  if (!POVOLENE_TYPY.includes(typ)) {
    return NextResponse.json(
      { error: 'Instagram vezme jen JPEG, PNG, WEBP, MP4 nebo MOV.' },
      { status: 400 },
    );
  }
  const strop = maxProTyp(typ);
  if (velikost > strop) {
    return NextResponse.json(
      { error: `Soubor je moc velký - vejde se do ${velikostVMB(strop)}.` },
      { status: 400 },
    );
  }

  const podpis = await podepsanyUploadPribehu(nazev, typ);
  if (!podpis) {
    return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });
  }
  return NextResponse.json(podpis);
}
