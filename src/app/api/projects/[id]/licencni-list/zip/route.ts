import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { hlavickyZipu, zipStream, type PolozkaZipu } from '@/lib/zip';

/**
 * VŠECHNY LICENČNÍ LISTY ZAKÁZKY V JEDNOM ZIPU (zadání 27. 9. 2026: „u těch
 * listů by mělo být i tlačítko stáhnout všechny").
 *
 * U zakázky je listů tolik, kolik je výstupů - u Strabagu pět. Stahovat je po
 * jednom je otrava, tak se sbalí za běhu a rovnou streamují ven (lib/zip.ts).
 * V archivu jsou pojmenované názvem spotu, ne interním názvem souboru.
 *
 * Práva jsou stejná jako u jednoho listu: tým Mediaspace všechny, klient jen
 * listy své firmy.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Název souboru bez znaků, které rozbíjejí cesty. */
function bezpecny(text: string): string {
  return text.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'licencni-list';
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const listy = (await prisma.licencniList.findMany({
    where: { caflouProjectId: params.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fileName: true,
      nazevSpotu: true,
      url: true,
      companyId: true,
      projectName: true,
      createdAt: true,
    },
  })) as {
    id: string;
    fileName: string;
    nazevSpotu: string;
    url: string;
    companyId: string | null;
    projectName: string;
    createdAt: Date;
  }[];

  if (listy.length === 0) {
    return NextResponse.json({ error: 'U zakázky zatím žádný licenční list není.' }, { status: 404 });
  }

  // Klient smí jen listy své firmy - stejné pravidlo jako u jednoho listu.
  if (!isInternalRole(session.user.role)) {
    const cizi = listy.some((l) => !l.companyId || l.companyId !== session.user.companyId);
    if (cizi) return NextResponse.json({ error: 'K těmto dokumentům nemáte přístup.' }, { status: 403 });
  }

  const polozky: PolozkaZipu[] = listy.map((l) => ({
    nazev: `${bezpecny(l.nazevSpotu || l.fileName.replace(/\.pdf$/i, ''))}.pdf`,
    datum: l.createdAt,
    nacti: async () => {
      // PDF je buď rovnou v záznamu (data URL), nebo v úložišti.
      if (l.url.startsWith('data:')) {
        return new Uint8Array(Buffer.from(l.url.slice(l.url.indexOf(',') + 1), 'base64'));
      }
      try {
        const res = await fetch(l.url);
        if (!res.ok || !res.body) return null;
        return res.body;
      } catch {
        // Jeden nedostupný soubor archiv neshodí - ostatní se stáhnou.
        return null;
      }
    },
  }));

  const nazevArchivu = `Licencni listy - ${bezpecny(listy[0].projectName || params.id)}.zip`;
  return new NextResponse(zipStream(polozky), { headers: hlavickyZipu(nazevArchivu) });
}
