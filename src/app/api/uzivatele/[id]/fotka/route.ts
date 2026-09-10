import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Profilová fotka uživatele jako obrázek (10. 9. 2026).
 *
 * Fotky jsou v databázi uložené jako data: URL. Kdyby se posílaly rovnou
 * v odpovědích, nesla by je s sebou každá zpráva v chatu znovu - viz
 * lib/fotky.ts. Takhle chodí jednou a prohlížeč si je nechá v mezipaměti.
 *
 * Fotky týmu nejsou veřejné, proto se vydávají jen přihlášeným. Mezipaměť je
 * schválně "private" - do sdílené mezipaměti na cestě takový obrázek nepatří.
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse(null, { status: 403 });

  const uzivatel = await prisma.user.findUnique({
    where: { id: params.id },
    select: { photoUrl: true },
  });
  if (!uzivatel?.photoUrl) return new NextResponse(null, { status: 404 });

  // Fotka uložená jinde (R2, Disk) - jen ukážeme kam, ať se nepřenáší přes nás.
  if (!uzivatel.photoUrl.startsWith('data:')) {
    return NextResponse.redirect(uzivatel.photoUrl, 307);
  }

  const obrazek = rozeber(uzivatel.photoUrl);
  if (!obrazek) return new NextResponse(null, { status: 404 });

  // Otisk obsahu: když si člověk nahraje jinou fotku, otisk se změní a
  // prohlížeč si stáhne novou. Dokud se nemění, odpovídáme 304 a neposíláme nic.
  const otisk = `"${createHash('sha1').update(uzivatel.photoUrl).digest('base64url').slice(0, 20)}"`;
  if (req.headers.get('if-none-match') === otisk) {
    return new NextResponse(null, { status: 304, headers: { ETag: otisk } });
  }

  return new NextResponse(new Uint8Array(obrazek.data), {
    headers: {
      'Content-Type': obrazek.typ,
      ETag: otisk,
      // Pět minut bez ptaní, pak se jen doptá na otisk - výměna fotky se tak
      // projeví rychle a přitom se obrázek nepřenáší pořád dokola.
      'Cache-Control': 'private, max-age=300, must-revalidate',
    },
  });
}
