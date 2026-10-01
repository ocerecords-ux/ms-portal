import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { klicZAdresyUloziste, podepsanyOdkazNaPrilohu } from '@/lib/storage';

/**
 * PRINTSCREEN U PŘIPOMÍNKY (oprava 1. 10. 2026: „nezobrazují se mi
 * printscreeny, když někdo vloží do připomínek").
 *
 * Náhled se kreslil rovnou z uložené adresy. Jenže ta míří na ROZHRANÍ
 * úložiště (`…r2.cloudflarestorage.com`) a to bez podpisu nikomu nic nevydá -
 * prohlížeč dostal 401 a v seznamu svítil rozbitý obrázek, přestože nahraný
 * byl. Je to tatáž past jako u profilových fotek 14. 9. 2026, jen o patro
 * vedle; proto i stejné řešení: obrázek se vydává přes portál a odkaz do
 * úložiště se podepisuje tady.
 *
 * KDO HO SMÍ VIDĚT: autor připomínky a Žůžo-labůžo. Na printscreenu bývá kus
 * cizí obrazovky - čísla, jména, rozpočet - a připomínky čte jen ten, kdo je
 * vyřizuje.
 */
export const dynamic = 'force-dynamic';

/** Rozebere data: URL na typ a bajty. Cokoliv divného vrátí jako null. */
function rozeber(dataUrl: string): { typ: string; data: Buffer } | null {
  // [\s\S] misto priznaku /s - ten chce novejsi cil prekladu, nez portal ma.
  const shoda = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!shoda) return null;
  const typ = shoda[1].toLowerCase();
  if (!typ.startsWith('image/')) return null;
  try {
    return { typ, data: Buffer.from(shoda[2], 'base64') };
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse(null, { status: 403 });

  const priloha = await prisma.pripominkaPriloha.findUnique({
    where: { id: params.id },
    select: { url: true, pripominka: { select: { userId: true } } },
  });
  if (!priloha) return new NextResponse(null, { status: 404 });

  const smi = priloha.pripominka.userId === session.user.id || session.user.role === 'ADMIN';
  if (!smi) return new NextResponse(null, { status: 403 });

  if (!priloha.url.startsWith('data:')) {
    const klic = klicZAdresyUloziste(priloha.url);
    const podepsany = klic ? await podepsanyOdkazNaPrilohu(klic, 'printscreen', false) : null;
    // Když se podepsat nepovede (klíč z adresy nejde vyčíst, úložiště není
    // nastavené), pošle se adresa tak, jak je - u veřejného úložiště fungovala.
    return NextResponse.redirect(podepsany || priloha.url, 307);
  }

  const obrazek = rozeber(priloha.url);
  if (!obrazek) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(obrazek.data), {
    headers: {
      'Content-Type': obrazek.typ,
      // Soukromá mezipaměť: printscreen z cizí obrazovky nepatří do sdílené
      // mezipaměti na cestě. Obsah se nemění, tak klidně na dlouho.
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
