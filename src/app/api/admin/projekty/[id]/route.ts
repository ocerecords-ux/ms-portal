import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { popisPrekazek, prekazkyProjektu } from '@/lib/mazani';
import { jeZpusobSmazani } from '@/lib/archiv';
import { odstranProjekt } from '@/lib/archivServer';

/**
 * Smazání projektu (zadání 10. 9. 2026: "potřeboval bych, aby šly smazat
 * projekty").
 *
 * Stejné pravidlo jako u firem a uživatelů: smaže se jen projekt, na kterém
 * opravdu nic nevisí - typicky omylem založený nebo testovací. Kdyby šlo
 * smazat cokoliv, zbyly by v účetnictví faktury a smlouvy u projektu, který
 * už neexistuje.
 *
 * Složka na Disku se schválně NEMAŽE. Portál do ní jen odkazuje, jsou v ní
 * nahrávky a smazat cizí data kvůli jednomu kliknutí v portálu by bylo přes
 * čáru - odkaz na ni je v odpovědi, ať si ji člověk uklidí sám, když chce.
 */
export const dynamic = 'force-dynamic';

/**
 * Smazani projektu. Viz poznamka u DELETE firmy - bez parametru se smaze jen
 * projekt, na kterem nic nevisi; s ?zpusob=archivovat / ?zpusob=smazat-vse se
 * vyresi i to navazane (zadani 10. 9. 2026).
 *
 * Doklady se u projektu neruší, jen se odpoji: nazev projektu si nesou
 * textem, takze v ucetnictvi zustanou citelne.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění mazat projekty.' }, { status: 403 });
  }

  const projekt = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: params.id },
    select: { name: true, driveUrl: true },
  });
  if (!projekt) return NextResponse.json({ error: 'Projekt nenalezen.' }, { status: 404 });
  const nazev = projekt.name || `Projekt ${params.id}`;

  const zpusob = req.nextUrl.searchParams.get('zpusob') ?? '';
  const prekazky = await prekazkyProjektu(params.id);

  if (prekazky.length > 0 && !jeZpusobSmazani(zpusob)) {
    return NextResponse.json(
      {
        error: `${nazev} nejde rovnou smazat, visí na něm: ${popisPrekazek(prekazky)}.`,
        prekazky,
      },
      { status: 409 },
    );
  }

  if (prekazky.length === 0) {
    await prisma.projektUdalost.deleteMany({ where: { caflouProjectId: params.id } });
    await prisma.notifikaceOdeslana.deleteMany({ where: { caflouProjectId: params.id } });
    await prisma.projectMeta.delete({ where: { caflouProjectId: params.id } });
    return NextResponse.json({ smazano: true, nazev, slozka: projekt.driveUrl });
  }

  try {
    const vysledek = await odstranProjekt({
      caflouProjectId: params.id,
      nazev,
      prekazky,
      archivovat: zpusob === 'archivovat',
      puvodce: { id: session.user.id, jmeno: session.user.name || session.user.email },
    });
    return NextResponse.json({ smazano: true, slozka: projekt.driveUrl, ...vysledek });
  } catch (err) {
    console.error('Smazání projektu selhalo:', err);
    return NextResponse.json(
      { error: 'Smazání se nepodařilo dokončit, takže se nic nesmazalo.' },
      { status: 409 },
    );
  }
}
