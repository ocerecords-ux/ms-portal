import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * Stažení archivu jako JSON (zadání 10. 9. 2026).
 *
 * Záměrně jako soubor ke stažení, ne stránka: archiv je záchranná kopie
 * a člověk si ji má odložit stranou, ne v něm listovat v prohlížeči.
 */
export const dynamic = 'force-dynamic';

/** Název souboru bez diakritiky a mezer - ať projde všude. */
function nazevSouboru(nazev: string, id: string): string {
  const ocisteny = nazev
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `archiv-${ocisteny || id}.json`;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const archiv = await prisma.archiv.findUnique({ where: { id: params.id } });
  if (!archiv) return NextResponse.json({ error: 'Archiv nenalezen.' }, { status: 404 });

  const telo = JSON.stringify(
    {
      druh: archiv.druh,
      nazev: archiv.nazev,
      puvodniId: archiv.puvodniId,
      souhrn: archiv.souhrn,
      smazal: archiv.uzivatelJmeno,
      smazanoAt: archiv.createdAt,
      obsah: archiv.obsah,
    },
    null,
    2,
  );

  return new NextResponse(telo, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nazevSouboru(archiv.nazev, archiv.id)}"`,
    },
  });
}
