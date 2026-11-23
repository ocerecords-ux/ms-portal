import { prisma } from '@/lib/db';

/**
 * ULOŽENÁ KŘIVKA A DÉLKA STOPY (zpětná vazba přeposlouchávačky 23. 11. 2026:
 * „křivka stop se kreslí při každém otevření stránky a počítá se délka
 * nahrávky - přijde mi, že by se to dalo odbourat uložením do databáze nebo
 * cache").
 *
 * Počítá to pořád prohlížeč (na serveru není Web Audio), ale jen jednou: kdo
 * knihu otevře první, výsledek pošle sem a všichni další ho dostanou hotový.
 *
 * VELIKOST JE SOUČÁSTÍ KLÍČE. Když se soubor na Disku vymění za jiný pod
 * stejným ID, uložená křivka by patřila k něčemu jinému - proto se vrací jen
 * tehdy, když velikost sedí.
 */

export type MetaStopy = { delka: number | null; peaks: [number, number][] | null };

export async function nactiMetaStop(
  soubory: { id: string; velikost: number | null }[],
): Promise<Record<string, MetaStopy>> {
  const ids = soubory.map((s) => s.id).filter(Boolean);
  if (ids.length === 0) return {};

  const radky = (await prisma.stopaMeta
    .findMany({ where: { souborId: { in: ids } } })
    .catch(() => [])) as {
    souborId: string;
    velikost: number | null;
    delka: number | null;
    peaks: unknown;
  }[];

  const velikosti = new Map(soubory.map((s) => [s.id, s.velikost ?? null]));
  const vysledek: Record<string, MetaStopy> = {};
  for (const r of radky) {
    const ocekavana = velikosti.get(r.souborId) ?? null;
    // Jiná velikost = jiný soubor; raději spočítat znovu než ukázat cizí křivku.
    if (r.velikost !== null && ocekavana !== null && r.velikost !== ocekavana) continue;
    vysledek[r.souborId] = {
      delka: typeof r.delka === 'number' && r.delka > 0 ? r.delka : null,
      peaks: jePeaks(r.peaks) ? (r.peaks as [number, number][]) : null,
    };
  }
  return vysledek;
}

function jePeaks(hodnota: unknown): boolean {
  return (
    Array.isArray(hodnota) &&
    hodnota.length > 0 &&
    Array.isArray(hodnota[0]) &&
    (hodnota[0] as unknown[]).length === 2
  );
}

/**
 * Zapíše, co prohlížeč spočítal. Co nepřijde, se nepřepisuje - délka a křivka
 * se zjišťují každá zvlášť a jedna nemá tu druhou mazat.
 */
export async function ulozMetaStopy(data: {
  souborId: string;
  velikost: number | null;
  delka?: number | null;
  peaks?: [number, number][] | null;
}): Promise<void> {
  const zmena = {
    ...(data.velikost !== null ? { velikost: data.velikost } : {}),
    ...(typeof data.delka === 'number' && data.delka > 0 ? { delka: data.delka } : {}),
    ...(data.peaks && data.peaks.length > 0 ? { peaks: data.peaks } : {}),
  };
  if (Object.keys(zmena).length === 0) return;

  await prisma.stopaMeta
    .upsert({
      where: { souborId: data.souborId },
      update: zmena,
      create: { souborId: data.souborId, ...zmena },
    })
    .catch((err: unknown) => console.error('Uložení křivky stopy selhalo:', err));
}
