import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { MAX_UKAZKA_BYTES, TYPY_UKAZEK } from '@/lib/prezentaceNabidky';
import { isStorageConfigured, podepsanyUploadUkazky } from '@/lib/storage';

/**
 * ADRESA, NA KTEROU PROHLÍŽEČ POŠLE UKÁZKU (11. 10. 2026). Soubor nejde přes
 * portál, ale rovnou do úložiště - reference s obrazem snadno přeroste strop
 * Vercelu (4,5 MB). Klíč v úložišti určuje výhradně server.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nazev: z.string().trim().min(1).max(255),
  typ: z.string().trim().max(160),
  velikost: z.number().int().positive().max(MAX_UKAZKA_BYTES),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'Ukázky zatím nejdou - portál nemá nastavené úložiště souborů.' },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  if (!TYPY_UKAZEK.includes(parsed.data.typ)) {
    return NextResponse.json({ error: 'Tenhle typ souboru jako ukázku nebereme.' }, { status: 400 });
  }

  const podpis = await podepsanyUploadUkazky(parsed.data.nazev, parsed.data.typ);
  if (!podpis) return NextResponse.json({ error: 'Adresu pro nahrání se nepodařilo připravit.' }, { status: 500 });

  return NextResponse.json(podpis);
}
