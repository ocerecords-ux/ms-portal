import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { hlavickyZipu, zipStream, type PolozkaZipu } from '@/lib/zip';

/**
 * VŠECHNY DOKUMENTY ZAKÁZKY V JEDNOM ZIPU (zadání 27. 9. 2026: „u těch listů
 * by mělo být i tlačítko stáhnout všechny").
 *
 * Balí se rodné i licenční listy - u zakázky je jich tolik, kolik je výstupů,
 * a stahovat je po jednom je otrava. Archiv se skládá za běhu a rovnou
 * streamuje ven (lib/zip.ts); soubory jsou v něm pojmenované názvem spotu,
 * ne interním názvem souboru.
 *
 * Práva jsou stejná jako u jednoho dokumentu: tým Mediaspace všechny, klient
 * jen dokumenty své firmy.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Název souboru bez znaků, které rozbíjejí cesty. */
function bezpecny(text: string): string {
  return text.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'dokument';
}

type Dokument = {
  nazev: string;
  url: string;
  companyId: string | null;
  vytvoreno: Date;
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const [licencni, rodne, meta] = await Promise.all([
    prisma.licencniList
      .findMany({
        where: { caflouProjectId: params.id },
        orderBy: { createdAt: 'asc' },
        select: { fileName: true, nazevSpotu: true, url: true, companyId: true, createdAt: true },
      })
      .catch(() => []),
    prisma.rodnyList
      .findMany({
        where: { caflouProjectId: params.id },
        orderBy: { createdAt: 'asc' },
        select: { fileName: true, vystupNazev: true, version: true, url: true, companyId: true, createdAt: true },
      })
      .catch(() => []),
    prisma.projectMeta.findUnique({ where: { caflouProjectId: params.id }, select: { name: true } }),
  ]);

  const dokumenty: Dokument[] = [
    ...(licencni as { fileName: string; nazevSpotu: string; url: string; companyId: string | null; createdAt: Date }[]).map(
      (l) => ({
        nazev: `Licencni list - ${bezpecny(l.nazevSpotu || l.fileName.replace(/\.pdf$/i, ''))}.pdf`,
        url: l.url,
        companyId: l.companyId,
        vytvoreno: l.createdAt,
      }),
    ),
    ...(
      rodne as {
        fileName: string;
        vystupNazev: string | null;
        version: number;
        url: string;
        companyId: string | null;
        createdAt: Date;
      }[]
    ).map((r) => ({
      // Rodných listů může být u jednoho výstupu víc verzí - číslo verze
      // v názvu drží pořadí a zabrání přepsání stejného jména v archivu.
      nazev: `Rodny list - ${bezpecny(r.vystupNazev || r.fileName.replace(/\.pdf$/i, ''))} (v${r.version}).pdf`,
      url: r.url,
      companyId: r.companyId,
      vytvoreno: r.createdAt,
    })),
  ];

  if (dokumenty.length === 0) {
    return NextResponse.json({ error: 'U zakázky zatím žádný dokument není.' }, { status: 404 });
  }

  if (!isInternalRole(session.user.role)) {
    const cizi = dokumenty.some((d) => !d.companyId || d.companyId !== session.user.companyId);
    if (cizi) return NextResponse.json({ error: 'K těmto dokumentům nemáte přístup.' }, { status: 403 });
  }

  const polozky: PolozkaZipu[] = dokumenty.map((d) => ({
    nazev: d.nazev,
    datum: d.vytvoreno,
    nacti: async () => {
      // PDF je buď rovnou v záznamu (data URL), nebo v úložišti.
      if (d.url.startsWith('data:')) {
        return new Uint8Array(Buffer.from(d.url.slice(d.url.indexOf(',') + 1), 'base64'));
      }
      try {
        const res = await fetch(d.url);
        if (!res.ok || !res.body) return null;
        return res.body;
      } catch {
        // Jeden nedostupný soubor archiv neshodí - ostatní se stáhnou.
        return null;
      }
    },
  }));

  const nazevArchivu = `Dokumenty - ${bezpecny(meta?.name || params.id)}.zip`;
  return new NextResponse(zipStream(polozky), { headers: hlavickyZipu(nazevArchivu) });
}
