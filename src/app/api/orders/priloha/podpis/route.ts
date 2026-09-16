import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isStorageConfigured, podepsanyUploadObjednavky } from '@/lib/storage';

/**
 * Adresa, na kterou prohlížeč pošle přílohu objednávky (oprava 16. 9. 2026:
 * „klientovi se nepodařilo odeslat objednávku").
 *
 * Do teď šel soubor spolu s objednávkou přes portál — jenže funkce na Vercelu
 * mají strop na velikost požadavku kolem 4,5 MB a naskenovaný rukopis ho
 * přeleze snadno. Objednávka pak skončila chybou 413 a formulář uměl říct jen
 * „Objednávku se nepodařilo odeslat"; o tom, že vadí velikost souboru, se
 * klient nedozvěděl nic. Chat tudy soubory posílá odjakživa (viz
 * /api/chat/prilohy/podpis), objednávka na to jen nebyla napojená.
 *
 * Klíč si určuje výhradně server a je vázaný na firmu ze session — kdyby ho
 * posílal prohlížeč, dal by se jím přepsat cizí soubor v úložišti.
 */
export const dynamic = 'force-dynamic';

/** Strop pro přílohu objednávky. Rukopisy bývají velké, ale ne takhle. */
export const MAX_PRILOHA_OBJEDNAVKY = 200 * 1024 * 1024;

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(160).optional(),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_PRILOHA_OBJEDNAVKY, 'Příloha je moc velká — pošlete ji prosím e-mailem.'),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: 'Nejste přihlášen k žádné firmě.' }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'Přílohy zatím nejdou — portál nemá nastavené úložiště souborů.' },
      { status: 503 },
    );
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Neplatná příloha.' },
        { status: 400 },
      );
    }

    const podpis = await podepsanyUploadObjednavky(
      parsed.data.name,
      parsed.data.mime || 'application/octet-stream',
      session.user.companyId,
    );
    if (!podpis) {
      return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });
    }

    return NextResponse.json(podpis);
  } catch (err) {
    console.error('POST /api/orders/priloha/podpis selhalo:', err);
    return NextResponse.json({ error: 'Přílohu se nepodařilo připravit.' }, { status: 500 });
  }
}
