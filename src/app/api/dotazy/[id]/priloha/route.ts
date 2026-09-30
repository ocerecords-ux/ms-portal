import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { projektPatriFirme } from '@/lib/dotazyServer';
import { MAX_PRILOHA_KLIENTA_BYTES, smiKlientPriloha } from '@/lib/chatPrilohy';
import { isStorageConfigured, podepsanyUploadPrilohy } from '@/lib/storage';

/**
 * ADRESA, NA KTEROU KLIENT NAHRAJE PŘÍLOHU K DOTAZU (zadání 30. 9. 2026:
 * „potřebuju, ať klienti můžou vložit pdf do chatu").
 *
 * VLASTNÍ CESTA, NE UVOLNĚNÍ /api/chat/prilohy/podpis. Ta je pro tým a ptá se
 * `canUseChat` - kdyby se povolila klientům, dostali by podepsanou adresu do
 * úložiště bez ohledu na projekt. Tady se pokaždé ověří, že projekt patří
 * firmě přihlášeného klienta, stejně jako u čtení a psaní dotazů.
 *
 * Co projde, hlídá `smiKlientPriloha` - PDF a obrázky. Soubor jde do úložiště
 * rovnou z prohlížeče (funkce na Vercelu mají strop kolem 4,5 MB) a portál
 * u zprávy jen ověří, že tam opravdu leží.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(160).optional(),
  size: z.number().int().positive().max(MAX_PRILOHA_KLIENTA_BYTES, 'Soubor je moc velký (nejvýš 15 MB).'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: 'Účet není napojený na firmu.' }, { status: 403 });
  }
  if (!(await projektPatriFirme(params.id, companyId))) {
    return NextResponse.json({ error: 'K tomuto projektu nemáte přístup.' }, { status: 403 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: 'Přílohy zatím nejdou — portál nemá nastavené úložiště souborů.' },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Neplatná příloha.' },
      { status: 400 },
    );
  }

  if (!smiKlientPriloha(parsed.data.mime, parsed.data.name)) {
    return NextResponse.json(
      { error: 'Přiložit jde PDF nebo obrázek.' },
      { status: 415 },
    );
  }

  try {
    const podpis = await podepsanyUploadPrilohy(
      parsed.data.name,
      parsed.data.mime || 'application/octet-stream',
    );
    if (!podpis) {
      return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });
    }
    return NextResponse.json(podpis);
  } catch (err) {
    console.error('POST /api/dotazy/[id]/priloha selhalo:', err);
    return NextResponse.json({ error: 'Přílohu se nepodařilo připravit.' }, { status: 500 });
  }
}
