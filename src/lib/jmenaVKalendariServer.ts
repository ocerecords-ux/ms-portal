import { prisma } from '@/lib/db';

/**
 * JMÉNA V KALENDÁŘI SE SROVNÁVAJÍ S ÚČTEM (zadání 19. 10. 2026: „tady se to
 * rozdelilo na dva herce, i kdyz to tak neni. Vzniklo to tim, ze jsme
 * dodatecne prejmenovali na - Brno. Zmen vsechny minule zanamy, at to sedi").
 *
 * PROČ TO VŮBEC VZNIKLO: natáčení v kalendáři i nabídka termínů si vedle id
 * účtu ukládají JMÉNO JAKO OTISK — záznam má zůstat čitelný, i kdyby účet
 * zanikl. Jenže otisk se pořídí jednou a při přejmenování účtu zůstane starý,
 * takže rozpis u názvu projektu ukázal „Ondřej Novák" a „Ondřej Novák - Brno"
 * jako dva lidi, protože je rozděluje právě to jméno.
 *
 * CO S TÍM: otisk se srovná s účtem všude, kde je u něj id. Rozhoduje ID, ne
 * podobnost jmen — nikdy se neslepí dva lidé, kteří se jen jmenují podobně,
 * a nesahá se na záznamy psané rukou bez účtu (casting, host), kde by se
 * jméno nemělo kde vzít.
 *
 * Volá se ze dvou míst: po přejmenování účtu v administraci (aby se to
 * neopakovalo) a jednorázově ze seedu (kvůli tomu, co už v databázi je).
 *
 * Nikdy nevyhazuje — přejmenování účtu nesmí spadnout na tom, že se nepovedlo
 * přepsat jméno u staré události v kalendáři.
 */

/** Kolik řádků se srovnalo - do logu seedu. */
export type SrovnanaJmena = { nataceni: number; strih: number; nabidky: number };

async function srovnejProUcty(ucty: { id: string; jmeno: string }[]): Promise<SrovnanaJmena> {
  const vysledek: SrovnanaJmena = { nataceni: 0, strih: 0, nabidky: 0 };

  for (const ucet of ucty) {
    const jmeno = ucet.jmeno.trim();
    if (!jmeno) continue;

    try {
      // Natáčení v kalendáři - herec.
      const nataceni = await prisma.studioBlock.updateMany({
        where: { actorUserId: ucet.id, NOT: { actorName: jmeno } },
        data: { actorName: jmeno },
      });
      vysledek.nataceni += (nataceni as { count: number }).count;

      // Natáčení i střih - zvukař. Tentýž otisk, tentýž problém.
      const strih = await prisma.studioBlock.updateMany({
        where: { zvukarUserId: ucet.id, NOT: { zvukarName: jmeno } },
        data: { zvukarName: jmeno },
      });
      vysledek.strih += (strih as { count: number }).count;

      // Nabídka termínů herci.
      const nabidky = await prisma.recordingRequest.updateMany({
        where: { actorUserId: ucet.id, NOT: { actorName: jmeno } },
        data: { actorName: jmeno },
      });
      vysledek.nabidky += (nabidky as { count: number }).count;
    } catch (err) {
      console.error(`Jména v kalendáři se nepodařilo srovnat u účtu ${ucet.id}:`, err);
    }
  }

  return vysledek;
}

/** Po přejmenování jednoho účtu. */
export async function srovnejJmenaVKalendari(userId: string): Promise<SrovnanaJmena> {
  try {
    const ucet = (await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    })) as { id: string; name: string | null } | null;
    if (!ucet?.name?.trim()) return { nataceni: 0, strih: 0, nabidky: 0 };
    return await srovnejProUcty([{ id: ucet.id, jmeno: ucet.name }]);
  } catch (err) {
    console.error('Jména v kalendáři se nepodařilo srovnat:', err);
    return { nataceni: 0, strih: 0, nabidky: 0 };
  }
}

/**
 * Jednorázově za všechny účty - tím se spraví, co v databázi zůstalo
 * z přejmenování, která proběhla dřív, než se tohle srovnávalo.
 */
export async function srovnejJmenaVKalendariVsem(): Promise<SrovnanaJmena> {
  try {
    const ucty = (await prisma.user.findMany({
      where: { name: { not: null } },
      select: { id: true, name: true },
    })) as { id: string; name: string | null }[];
    return await srovnejProUcty(
      ucty.filter((u): u is { id: string; name: string } => Boolean(u.name?.trim())).map((u) => ({
        id: u.id,
        jmeno: u.name,
      })),
    );
  } catch (err) {
    console.error('Jména v kalendáři se nepodařilo srovnat hromadně:', err);
    return { nataceni: 0, strih: 0, nabidky: 0 };
  }
}
