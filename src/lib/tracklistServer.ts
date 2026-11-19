import { prisma } from '@/lib/db';
import { upravNazevTracku } from '@/lib/tracklist';
import type { Track } from '@/lib/tracklist';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026: „vytvoř v detailu každého
 * projektu, který je audiokniha, ještě záložku tracklist. Tam bude seznam
 * tracků editovatelný" → „pořadové číslo, název tracku, název kapitoly"
 * → „01, 02, 03").
 *
 * TŘI SLOUPCE, PROTOŽE JSOU TO TŘI RŮZNÉ VĚCI:
 *  - POŘADOVÉ ČÍSLO se nezadává, dopočítá se z pořadí v seznamu a píše se
 *    vždy dvojmístně (01, 02, 03) - stejně jako na začátku názvů souborů.
 *  - NÁZEV TRACKU je jméno samotné stopy / souboru.
 *  - NÁZEV KAPITOLY je, jak se kapitola jmenuje ve výchozí knize. Nemusí
 *    být - ne každá kniha pojmenované kapitoly má, a tehdy se do tagu
 *    title dává název tracku, jen s diakritikou.
 *
 * NIC SE ODNIKUD NENAČÍTÁ (upřesnění 15. 10. 2026: „nechci nikde načítat
 * tracklist"). Tracklist je PŘEDPIS, podle kterého se stopy teprve pojmenují,
 * ne soupis toho, co na Disku leží. Zakládá se naráz z vlastního vzoru.
 */

export type { Track } from '@/lib/tracklist';
export { cisloTracku } from '@/lib/tracklist';

/**
 * SMÍ SE U TOHOHLE PROJEKTU TRACKLIST GENEROVAT Z TEXTU? (zadání
 * 30. 10. 2026: „ale takto jen u Audiotéky"). Rozhoduje PŘÍZNAK U FIRMY, ne
 * název firmy v kódu - viz Company.tracklistZTextu a lib/tracklistZTextu.ts.
 */
export async function generovaniZTextuPovoleno(caflouProjectId: string): Promise<boolean> {
  const meta = await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId },
      select: { company: { select: { tracklistZTextu: true } } },
    })
    .catch(() => null);
  return meta?.company?.tracklistZTextu === true;
}

export async function nactiTracklist(caflouProjectId: string): Promise<Track[]> {
  const radky = await prisma.trackProjektu
    .findMany({ where: { caflouProjectId }, orderBy: { poradi: 'asc' } })
    .catch(() => [] as { poradi: number; nazevTracku: string; nazevKapitoly: string }[]);
  return radky.map((r) => ({
    poradi: r.poradi,
    nazevTracku: r.nazevTracku ?? '',
    nazevKapitoly: r.nazevKapitoly ?? '',
  }));
}


/**
 * SMÍ TENHLE KLIENT K TRACKLISTU? (zadání 19. 11. 2026: „a pak by se k němu
 * měli dostat i v portálu").
 *
 * Dvě podmínky zároveň: firma to má na kartě zapnuté (Company.tracklistOdKlienta)
 * a zakázka té firmě opravdu patří. Firma se porovnává stejně jako v přehledu
 * zakázek - projekty z Caflou vazbu na firmu nemají, jen její jméno textem.
 */
export async function klientSmiTracklist(
  caflouProjectId: string,
  companyId: string | null | undefined,
): Promise<boolean> {
  if (!companyId) return false;
  const [firma, meta] = await Promise.all([
    prisma.company
      .findUnique({ where: { id: companyId }, select: { name: true, tracklistOdKlienta: true } })
      .catch(() => null),
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId }, select: { companyId: true, companyName: true } })
      .catch(() => null),
  ]);
  const smiFirma = (firma as { name: string; tracklistOdKlienta: boolean } | null);
  if (!smiFirma?.tracklistOdKlienta) return false;
  const kdo = meta as { companyId: string | null; companyName: string | null } | null;
  if (!kdo) return false;
  if (kdo.companyId) return kdo.companyId === companyId;
  return (
    Boolean(kdo.companyName) &&
    kdo.companyName!.trim().toLowerCase() === smiFirma.name.trim().toLowerCase()
  );
}

/**
 * ULOŽÍ CELÝ TRACKLIST NARÁZ. Jedno místo pro obě cesty, kterými teď seznam
 * přichází - z karty projektu od nás i od klienta (z odkazu v mailu nebo
 * z jeho přehledu zakázek). Pravidlo o tvaru názvu stopy je tím pádem jedno,
 * ne tři kopie.
 */
export async function ulozTracklist(
  caflouProjectId: string,
  tracky: { nazevTracku: string; nazevKapitoly: string }[],
): Promise<Track[]> {
  const sMezerami = await generovaniZTextuPovoleno(caflouProjectId);
  const radky = tracky
    .map((t) => ({
      nazevTracku: upravNazevTracku(t.nazevTracku, sMezerami),
      nazevKapitoly: t.nazevKapitoly.trim(),
    }))
    // Úplně prázdné řádky se zahazují; stačí ale vyplněný jeden ze dvou názvů.
    .filter((t) => t.nazevTracku || t.nazevKapitoly);

  // Celý seznam naráz: staré pryč, nové podle pořadí v poli. Jedna transakce,
  // takže v půlce uložení nikdo neuvidí poloviční tracklist.
  await prisma.$transaction([
    prisma.trackProjektu.deleteMany({ where: { caflouProjectId } }),
    prisma.trackProjektu.createMany({
      data: radky.map((t, i) => ({ caflouProjectId, poradi: i + 1, ...t })),
    }),
  ]);
  return nactiTracklist(caflouProjectId);
}
