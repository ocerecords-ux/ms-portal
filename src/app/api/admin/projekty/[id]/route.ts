import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { popisPrekazek, prekazkyProjektu } from '@/lib/mazani';

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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

  const prekazky = await prekazkyProjektu(params.id);
  if (prekazky.length > 0) {
    return NextResponse.json(
      {
        error: `${nazev} nejde smazat, visí na něm: ${popisPrekazek(prekazky)}. Nejdřív ty doklady odpojte nebo smažte.`,
        prekazky,
      },
      { status: 409 },
    );
  }

  await prisma.projectMeta.delete({ where: { caflouProjectId: params.id } });
  return NextResponse.json({ smazano: true, nazev, slozka: projekt.driveUrl });
}
