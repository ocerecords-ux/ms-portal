import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadPripominkaObrazek } from '@/lib/storage';
import { MAX_DELKA_TEXTU, MAX_PRILOH } from '@/lib/pripominky';
import { mojePripominky, podobnePripominky, vsechnyPripominky } from '@/lib/pripominkyServer';

/**
 * Zpětná vazba k portálu (zadání 15. 9. 2026). Psát smí každý přihlášený,
 * číst cizí připomínky jen Žůžo-labůžo.
 */
export const dynamic = 'force-dynamic';

/** GET ?podobne=<text> vrátí podobné připomínky; bez parametru vrátí moje. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const text = req.nextUrl.searchParams.get('podobne');
  if (text !== null) {
    return NextResponse.json({ podobne: await podobnePripominky(text) });
  }

  if (req.nextUrl.searchParams.get('vse') === '1') {
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    return NextResponse.json(await vsechnyPripominky());
  }

  return NextResponse.json({ pripominky: await mojePripominky(session.user.id) });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

    const form = await req.formData();
    const text = String(form.get('text') ?? '').trim();
    const odkud = String(form.get('odkud') ?? '').trim() || null;
    // Připojení k existující připomínce místo založení další (duplicity).
    const podobnaId = String(form.get('podobnaId') ?? '').trim() || null;

    if (!text) return NextResponse.json({ error: 'Napište prosím, co se má opravit.' }, { status: 400 });
    if (text.length > MAX_DELKA_TEXTU) {
      return NextResponse.json({ error: 'Připomínka je moc dlouhá — zkuste to stručněji.' }, { status: 400 });
    }

    const soubory = form.getAll('prilohy').filter((f): f is File => f instanceof File && f.size > 0);
    if (soubory.length > MAX_PRILOH) {
      return NextResponse.json({ error: `Najednou jde přiložit nejvýš ${MAX_PRILOH} obrázky.` }, { status: 400 });
    }

    const prilohy: { url: string; nazev: string }[] = [];
    for (const soubor of soubory) {
      const buffer = Buffer.from(await soubor.arrayBuffer());
      const ulozeno = await uploadPripominkaObrazek(buffer, soubor.name || 'printscreen.png', soubor.type);
      if ('error' in ulozeno) return NextResponse.json({ error: ulozeno.error }, { status: 400 });
      prilohy.push({ url: ulozeno.url, nazev: ulozeno.name });
    }

    const pripominka = await prisma.pripominkaPortalu.create({
      data: {
        userId: session.user.id,
        text,
        odkud,
        podobnaId,
        prilohy: prilohy.length ? { create: prilohy } : undefined,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: pripominka.id });
  } catch (err) {
    console.error('POST /api/pripominky selhalo:', err);
    return NextResponse.json({ error: 'Připomínku se nepodařilo uložit.' }, { status: 500 });
  }
}
