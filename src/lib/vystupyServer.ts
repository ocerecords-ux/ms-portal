import { prisma } from '@/lib/db';
import { serad, type VystupData } from '@/lib/vystupy';

/**
 * VÝSTUPY PROJEKTU - databázová část (zadání 26. 9. 2026).
 *
 * Čtení, zakládání a úpravy. Čisté funkce a typy jsou ve vystupy.ts, aby se
 * daly použít i ve formuláři v prohlížeči.
 *
 * PŘEVOD STARŠÍCH PROJEKTŮ je tady taky (`zalozVystupZProjektu`): projekt, na
 * kterém se vyplňoval rodný list ještě před výstupy, si při prvním otevření
 * založí jeden výstup z dnešních polí ProjectMety. Dělá se to líně při čtení,
 * ne dávkou přes celou databázi - projektů jsou stovky a většina z nich žádný
 * spot nemá.
 */

/** Datum z databáze jako YYYY-MM-DD, jak ho čeká <input type="date">. */
function denNaVstup(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** YYYY-MM-DD z formuláře na půlnoc UTC - ať se datum neposune podle pásma. */
export function vstupNaDen(hodnota: string | null | undefined): Date | null {
  if (!hodnota) return null;
  const d = new Date(`${hodnota}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

type VystupZDb = {
  id: string;
  poradi: number;
  nazev: string;
  typKlic: string | null;
  delkaSekund: number | null;
  odvozenoZId: string | null;
  sluzby: string[];
  herci: { id: string }[];
  rezie: string | null;
  hudbaNazev: string | null;
  hudbaAutor: string | null;
  bezHudby: boolean;
  datumVyroby: Date | null;
  klientNaRL: string | null;
  licence: { id: string }[];
  licenceUziti: string | null;
  licenceOd: Date | null;
  licenceMesicu: number | null;
  hotovoAt: Date | null;
  potvrzenoAt: Date | null;
};

const VYBER = {
  id: true,
  poradi: true,
  nazev: true,
  typKlic: true,
  delkaSekund: true,
  odvozenoZId: true,
  sluzby: true,
  herci: { select: { id: true } },
  rezie: true,
  hudbaNazev: true,
  hudbaAutor: true,
  bezHudby: true,
  datumVyroby: true,
  klientNaRL: true,
  licence: { select: { id: true } },
  licenceUziti: true,
  licenceOd: true,
  licenceMesicu: true,
  hotovoAt: true,
  potvrzenoAt: true,
} as const;

export function naData(v: VystupZDb): VystupData {
  return {
    id: v.id,
    poradi: v.poradi,
    nazev: v.nazev,
    typKlic: v.typKlic,
    delkaSekund: v.delkaSekund,
    odvozenoZId: v.odvozenoZId,
    sluzby: v.sluzby ?? [],
    herciIds: (v.herci ?? []).map((h) => h.id),
    rezie: v.rezie,
    hudbaNazev: v.hudbaNazev,
    hudbaAutor: v.hudbaAutor,
    bezHudby: v.bezHudby,
    datumVyroby: denNaVstup(v.datumVyroby),
    klientNaRL: v.klientNaRL,
    licenceIds: (v.licence ?? []).map((l) => l.id),
    licenceUziti: v.licenceUziti,
    licenceOd: denNaVstup(v.licenceOd),
    licenceMesicu: v.licenceMesicu,
    hotovo: Boolean(v.hotovoAt),
    potvrzeno: Boolean(v.potvrzenoAt),
  };
}

/** Výstupy projektu seřazené tak, jak se ukazují (downcut hned za svým spotem). */
export async function nactiVystupy(caflouProjectId: string): Promise<VystupData[]> {
  try {
    const radky = await prisma.vystup.findMany({
      where: { caflouProjectId },
      orderBy: [{ poradi: 'asc' }, { createdAt: 'asc' }],
      select: VYBER,
    });
    return serad((radky as unknown as VystupZDb[]).map(naData));
  } catch (err) {
    console.error(`Načtení výstupů projektu ${caflouProjectId} selhalo:`, err);
    return [];
  }
}

/** Jeden výstup i s projektem, ke kterému patří - pro úpravy přes API. */
export async function nactiVystup(id: string) {
  try {
    const v = await prisma.vystup.findUnique({
      where: { id },
      select: { ...VYBER, caflouProjectId: true },
    });
    if (!v) return null;
    return { caflouProjectId: (v as unknown as VystupZDb & { caflouProjectId: string }).caflouProjectId, data: naData(v as unknown as VystupZDb) };
  } catch (err) {
    console.error(`Načtení výstupu ${id} selhalo:`, err);
    return null;
  }
}

/** Hodnoty, které jdou u výstupu měnit. `undefined` = nesahat. */
export type ZmenaVystupu = {
  nazev?: string;
  typKlic?: string | null;
  delkaSekund?: number | null;
  sluzby?: string[];
  herciIds?: string[];
  rezie?: string | null;
  hudbaNazev?: string | null;
  hudbaAutor?: string | null;
  bezHudby?: boolean;
  datumVyroby?: string | null;
  klientNaRL?: string | null;
  licenceIds?: string[];
  licenceUziti?: string | null;
  licenceOd?: string | null;
  licenceMesicu?: number | null;
  hotovo?: boolean;
  potvrzeno?: boolean;
};

function naZapis(zmena: ZmenaVystupu): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (zmena.nazev !== undefined) data.nazev = zmena.nazev.trim();
  if (zmena.typKlic !== undefined) data.typKlic = zmena.typKlic?.trim() || null;
  if (zmena.delkaSekund !== undefined) data.delkaSekund = zmena.delkaSekund;
  if (zmena.sluzby !== undefined) data.sluzby = zmena.sluzby;
  if (zmena.rezie !== undefined) data.rezie = zmena.rezie?.trim() || null;
  if (zmena.hudbaNazev !== undefined) data.hudbaNazev = zmena.hudbaNazev?.trim() || null;
  if (zmena.hudbaAutor !== undefined) data.hudbaAutor = zmena.hudbaAutor?.trim() || null;
  if (zmena.bezHudby !== undefined) data.bezHudby = zmena.bezHudby;
  if (zmena.datumVyroby !== undefined) data.datumVyroby = vstupNaDen(zmena.datumVyroby);
  if (zmena.klientNaRL !== undefined) data.klientNaRL = zmena.klientNaRL?.trim() || null;
  if (zmena.licenceUziti !== undefined) data.licenceUziti = zmena.licenceUziti?.trim() || null;
  if (zmena.licenceOd !== undefined) data.licenceOd = vstupNaDen(zmena.licenceOd);
  if (zmena.licenceMesicu !== undefined) data.licenceMesicu = zmena.licenceMesicu;
  // Hotovo i potvrzeno se ukládají jako OKAMŽIK, ne jako zaškrtávátko: „kdo to
  // odbavil a kdy" je později k nezaplacení a z boolean se to nedá dopočítat.
  if (zmena.hotovo !== undefined) data.hotovoAt = zmena.hotovo ? new Date() : null;
  if (zmena.potvrzeno !== undefined) data.potvrzenoAt = zmena.potvrzeno ? new Date() : null;
  if (zmena.herciIds !== undefined) data.herci = { set: zmena.herciIds.map((id) => ({ id })) };
  if (zmena.licenceIds !== undefined) data.licence = { set: zmena.licenceIds.map((id) => ({ id })) };
  return data;
}

/** Nový výstup na konec seznamu; `odvozenoZId` z něj dělá downcut. */
export async function zalozVystup(
  caflouProjectId: string,
  vstup: ZmenaVystupu & { odvozenoZId?: string | null },
): Promise<VystupData | null> {
  try {
    const posledni = await prisma.vystup.findFirst({
      where: { caflouProjectId },
      orderBy: { poradi: 'desc' },
      select: { poradi: true },
    });

    const v = await prisma.vystup.create({
      data: {
        caflouProjectId,
        poradi: (posledni?.poradi ?? 0) + 10,
        nazev: vstup.nazev?.trim() || 'Výstup',
        odvozenoZId: vstup.odvozenoZId ?? null,
        // Co zakládáme my, je potvrzené rovnou - potvrzování je tu kvůli
        // návrhům z objednávky (rozhodnutí 26. 9. 2026).
        potvrzenoAt: vstup.potvrzeno === false ? null : new Date(),
        ...naZapis({ ...vstup, nazev: undefined, potvrzeno: undefined }),
      },
      select: VYBER,
    });
    return naData(v as unknown as VystupZDb);
  } catch (err) {
    console.error(`Založení výstupu u projektu ${caflouProjectId} selhalo:`, err);
    return null;
  }
}

export async function upravVystup(id: string, zmena: ZmenaVystupu): Promise<VystupData | null> {
  try {
    const v = await prisma.vystup.update({
      where: { id },
      data: naZapis(zmena),
      select: VYBER,
    });
    return naData(v as unknown as VystupZDb);
  } catch (err) {
    console.error(`Úprava výstupu ${id} selhala:`, err);
    return null;
  }
}

/**
 * Smazání výstupu. Downcuty pod ním se nemažou - jen se z nich stanou
 * samostatné výstupy, ať se vyrobená práce neztratí kliknutím vedle.
 * Výstup, ke kterému už visí rodný list, se nemaže vůbec.
 */
export async function smazVystup(id: string): Promise<{ ok: true } | { ok: false; duvod: string }> {
  try {
    const rl = await prisma.rodnyList.count({ where: { vystupId: id } });
    if (rl > 0) {
      return { ok: false, duvod: 'K výstupu už je vyrobený rodný list — smazat ho nejde.' };
    }
    await prisma.vystup.updateMany({ where: { odvozenoZId: id }, data: { odvozenoZId: null } });
    await prisma.vystup.delete({ where: { id } });
    return { ok: true };
  } catch (err) {
    console.error(`Smazání výstupu ${id} selhalo:`, err);
    return { ok: false, duvod: 'Výstup se nepodařilo smazat.' };
  }
}

/**
 * PŘEVOD PROJEKTU, KTERÝ VZNIKL PŘED VÝSTUPY.
 *
 * Projekt, na kterém se vyplňoval rodný list, měl údaje o spotu přímo na
 * ProjectMetě. Při prvním otevření záložky Výstupy se z nich založí jeden
 * výstup #1 - projekt s jedním spotem tak vypadá po převodu úplně stejně jako
 * předtím, jen má pod sebou řádek místo prázdna.
 *
 * Nic se nemaže: pole na ProjectMetě zůstávají, dokud na ně něco spoléhá.
 * Voláme to líně při čtení, takže se nepřevádí projekty, které nikdo neotevře.
 */
export async function prevedStaryProjekt(
  caflouProjectId: string,
  nazevProjektu: string,
): Promise<VystupData[]> {
  try {
    const uz = await prisma.vystup.count({ where: { caflouProjectId } });
    if (uz > 0) return [];

    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        projectType: true,
        spotName: true,
        spotLengthSeconds: true,
        directorName: true,
        rlClientName: true,
        musicTitle: true,
        musicAuthor: true,
        noMusic: true,
        productionDate: true,
        licenceUziti: true,
        licence: { select: { id: true } },
        herci: { select: { id: true } },
      },
    });
    if (!meta) return [];

    // Prázdný projekt se nepřevádí - kdo nic o spotu nevyplnil, dostane
    // rovnou čistý seznam a založí si výstup sám.
    const maCoPrevest =
      Boolean(meta.spotName) ||
      meta.spotLengthSeconds != null ||
      Boolean(meta.directorName) ||
      Boolean(meta.musicTitle) ||
      Boolean(meta.musicAuthor) ||
      meta.noMusic ||
      Boolean(meta.productionDate) ||
      Boolean(meta.licenceUziti) ||
      (meta.licence ?? []).length > 0;
    if (!maCoPrevest) return [];

    await prisma.vystup.create({
      data: {
        caflouProjectId,
        poradi: 10,
        nazev: (meta.spotName || nazevProjektu || 'Výstup').trim(),
        typKlic: meta.projectType ?? null,
        delkaSekund: meta.spotLengthSeconds ?? null,
        rezie: meta.directorName ?? null,
        klientNaRL: meta.rlClientName ?? null,
        hudbaNazev: meta.musicTitle ?? null,
        hudbaAutor: meta.musicAuthor ?? null,
        bezHudby: meta.noMusic,
        datumVyroby: meta.productionDate ?? null,
        licenceUziti: meta.licenceUziti ?? null,
        potvrzenoAt: new Date(),
        licence: { connect: (meta.licence ?? []).map((l) => ({ id: l.id })) },
        // Herci projektu se do jediného výstupu propíšou celí - dokud byl
        // projekt jeden spot, byli v něm opravdu všichni.
        herci: { connect: (meta.herci ?? []).map((h) => ({ id: h.id })) },
      },
    });

    return nactiVystupy(caflouProjectId);
  } catch (err) {
    console.error(`Převod projektu ${caflouProjectId} na výstupy selhal:`, err);
    return [];
  }
}

/**
 * Výstupy k zobrazení: co je uložené, a když projekt ještě nic nemá, zkusí se
 * převod ze starých polí. Tohle volají stránky.
 */
export async function vystupyProProjekt(
  caflouProjectId: string,
  nazevProjektu: string,
): Promise<VystupData[]> {
  const ulozene = await nactiVystupy(caflouProjectId);
  if (ulozene.length > 0) return ulozene;
  return prevedStaryProjekt(caflouProjectId, nazevProjektu);
}

/** Kolik výstupů projekty mají - do přehledu projektů (odznak „4 výstupy"). */
export async function poctyVystupu(caflouProjectIds: string[]): Promise<Map<string, number>> {
  const vysledek = new Map<string, number>();
  if (caflouProjectIds.length === 0) return vysledek;
  try {
    const radky = await prisma.vystup.groupBy({
      by: ['caflouProjectId'],
      where: { caflouProjectId: { in: caflouProjectIds } },
      _count: { _all: true },
    });
    for (const r of radky as { caflouProjectId: string; _count: { _all: number } }[]) {
      vysledek.set(r.caflouProjectId, r._count._all);
    }
  } catch (err) {
    console.error('Počty výstupů se nepodařilo načíst:', err);
  }
  return vysledek;
}
