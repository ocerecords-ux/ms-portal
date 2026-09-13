import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Fotka manažera projektu u konkrétní nabídky (zadání 13. 9. 2026: „a co
 * kdybychom to udělali více osobní? Fotku manažera, jméno a kontakt").
 *
 * Fotky týmu nejsou veřejné - vydávají se jen přihlášeným (viz
 * /api/uzivatele/[id]/fotka). Tady je ale na druhé straně klient, který se
 * nepřihlašuje: má jen jednorázový token nabídky. Proto se fotka vydává
 * VÝHRADNĚ proti tomu tokenu a vždycky jen fotka manažera té jedné nabídky.
 * Kdo token nemá, nedostane nic; žádné ID uživatele se v adrese neobjevuje.
 *
 * Adresa se používá i v e-mailu, takže obrázek stahuje poštovní klient
 * (u Gmailu jeho proxy) - odtud veřejná, ale krátká mezipaměť.
 */
export const dynamic = 'force-dynamic';

/** Rozebere data: URL na typ a bajty. Cokoliv divného vrátí jako null. */
function rozeber(dataUrl: string): { typ: string; data: Buffer } | null {
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

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const offer = await prisma.offer.findUnique({
    where: { approvalToken: params.token },
    select: { caflouProjectId: true },
  });
  if (!offer?.caflouProjectId) return new NextResponse(null, { status: 404 });

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: offer.caflouProjectId },
    select: { manager: { select: { photoUrl: true } } },
  });
  const fotka = meta?.manager?.photoUrl;
  if (!fotka) return new NextResponse(null, { status: 404 });

  // Fotka uložená jinde (R2, Disk) - jen ukážeme kam, ať se nepřenáší přes nás.
  if (!fotka.startsWith('data:')) return NextResponse.redirect(fotka, 307);

  const obrazek = rozeber(fotka);
  if (!obrazek) return new NextResponse(null, { status: 404 });

  const otisk = `"${createHash('sha1').update(fotka).digest('base64url').slice(0, 20)}"`;
  if (req.headers.get('if-none-match') === otisk) {
    return new NextResponse(null, { status: 304, headers: { ETag: otisk } });
  }

  return new NextResponse(new Uint8Array(obrazek.data), {
    headers: {
      'Content-Type': obrazek.typ,
      ETag: otisk,
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
