import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { icsProHosta, nactiNataceni } from '@/lib/hosteNataceniServer';

/**
 * „PŘIDAT DO KALENDÁŘE" Z POZVÁNKY NA NATÁČENÍ (zadání 9. 10. 2026: „mělo by
 * tam jít přidat tu událost do kalendáře někde i s odkazem").
 *
 * Příloha .ics v mailu sama nestačí - část schránek ji schová mezi přílohy
 * a na telefonu se klepnutím neotevře. Tenhle odkaz vrátí totéž, jen jako
 * stránku, kterou kalendář otevře rovnou.
 *
 * ŽÁDNÉ PŘIHLÁŠENÍ: host je člověk zvenčí a odkaz je jediné, co má. Chrání ho
 * náhodný token - ne id hosta, které chodí v odpovědích API. Vrací se jen
 * jeden termín toho jednoho hosta, nic víc, a token jde kdykoli zahodit
 * smazáním hosta u natáčení.
 *
 * SESTAVUJE SE AŽ PŘI VYŽÁDÁNÍ, takže po přesunu termínu vede tentýž odkaz
 * ze starého mailu na opravený čas - a host si do kalendáře nedostane termín,
 * který už neplatí.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  // Kalendáře občas přidají příponu .ics - ať odkaz funguje s ní i bez ní.
  const token = params.token.replace(/\.ics$/i, '');
  if (!token) return new NextResponse('Odkaz už neplatí.', { status: 404 });

  const host = await prisma.hostNataceni
    .findUnique({
      where: { kalendarToken: token },
      select: { blockId: true, block: { select: { projectName: true } } },
    })
    .catch(() => null);
  if (!host) return new NextResponse('Odkaz už neplatí.', { status: 404 });

  const nalezeno = await nactiNataceni(host.blockId);
  if (!nalezeno) return new NextResponse('Termín už v kalendáři není.', { status: 404 });

  const nazevProjektu = host.block?.projectName?.trim() || nalezeno.data.nazev;
  const obsah = icsProHosta(nalezeno.data, nazevProjektu);

  return new NextResponse(obsah, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="nataceni.ics"',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
