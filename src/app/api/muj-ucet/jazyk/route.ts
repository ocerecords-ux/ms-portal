import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * ULOŽENÍ JAZYKA NA ÚČET (dávka 6 překladu, 27. 9. 2026).
 *
 * Přepínač v liště zapisuje cookie - díky ní přijde stránka ze serveru rovnou
 * přeložená. Cookie ale zná jenom prohlížeč, a e-mail odchází odjinud: z cronu
 * (měsíční přehled, upomínky) nebo z akce někoho úplně jiného (zvukař označí
 * přeposlech, klientovi odejde zpráva). V takové chvíli žádná cookie není,
 * a bez ní není podle čeho poznat, jakým jazykem člověku psát.
 *
 * Proto se volba ukládá i na účet. Je to JEDINÝ zápis, nic jiného tahle routa
 * neumí - kdyby selhala, jazyk stránky to neovlivní.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ jazyk: z.enum(['cs', 'en']) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Nepřihlášený má jazyk v cookii a víc nepotřebuje - není komu ho uložit.
    return NextResponse.json({ ok: true, ulozeno: false });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatný jazyk.' }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { jazyk: parsed.data.jazyk },
    });
    return NextResponse.json({ ok: true, ulozeno: true });
  } catch {
    // Přepnutí jazyka v prohlížeči nesmí spadnout kvůli databázi.
    return NextResponse.json({ ok: true, ulozeno: false });
  }
}
