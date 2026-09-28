import type { Currency, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { PRAZDNY_CENIK, VYCHOZI_CENIK_LONDYN, type Cenik, type RadekCeniku } from '@/lib/studioCenik';

/**
 * Ceník studia - databázová část. Rozhodnutí a formát jsou v lib/studioCenik.ts.
 *
 * KDO HO SMÍ MĚNIT (zadání 28. 9. 2026: „spravovat by to mělo jen Žůžo-labůžo
 * a Matěj"): Žůžo-labůžo všude, vedoucí pobočky ve svém studiu. Matěj má
 * Londýn zaškrtnutý jako vedoucí, takže se nemusí zadrátovávat jménem - a až
 * pobočku povede někdo další, funguje to samo.
 *
 * SCHVÁLNĚ TO NEJDE PŘES `spravovanaStudia` z lib/spravaKalendare.ts, i když
 * to vypadá stejně: tam smí i Produkce, protože plánovat kalendář je její
 * denní práce. Ceny studia ale Produkce nastavovat nemá.
 */

export async function smiSpravovatCenik(
  userId: string,
  role: Role,
  studioId: string,
): Promise<boolean> {
  if (role === 'ADMIN') return true;
  try {
    const ucet = await prisma.user.findUnique({
      where: { id: userId },
      select: { vedeStudia: { select: { id: true } } },
    });
    return (ucet?.vedeStudia ?? []).some((s: { id: string }) => s.id === studioId);
  } catch (err) {
    console.error('Práva k ceníku studia se nepodařilo načíst:', err);
    return false;
  }
}

/** Studia, ve kterých ten člověk smí sahat na ceník - do přepínače nahoře. */
export async function studiaSCenikem(
  userId: string,
  role: Role,
): Promise<{ id: string; name: string; shortName: string }[]> {
  const vyber = { id: true, name: true, shortName: true };
  try {
    if (role === 'ADMIN') {
      return await prisma.studio.findMany({
        where: { active: true, parentStudioId: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: vyber,
      });
    }
    const ucet = await prisma.user.findUnique({
      where: { id: userId },
      select: { vedeStudia: { where: { active: true }, orderBy: { name: 'asc' }, select: vyber } },
    });
    return ucet?.vedeStudia ?? [];
  } catch (err) {
    console.error('Studia s ceníkem se nepodařilo načíst:', err);
    return [];
  }
}

function doIso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

/**
 * Ceník studia. Když ho studio ještě nemá, ZALOŽÍ SE z výchozího vzoru -
 * Londýn dostane ten z wordu, ostatní prázdný. Zakládá se až při prvním
 * otevření, ne v seedu: většina studií ceník mít nebude a prázdné řádky
 * v databázi by jen strašily.
 */
export async function zajistiCenik(studioId: string): Promise<Cenik & { id: string }> {
  const existuje = await prisma.studioCenik.findUnique({
    where: { studioId },
    include: { radky: { orderBy: { poradi: 'asc' } } },
  });
  if (existuje) return doTvaru(existuje);

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { name: true, timezone: true },
  });
  // Londýn se pozná podle pásma - stejně jako u svátků v kalendáři.
  const vzor = studio?.timezone === 'Europe/London' ? VYCHOZI_CENIK_LONDYN : PRAZDNY_CENIK;

  const vytvoreny = await prisma.studioCenik.create({
    data: {
      studioId,
      nadpis: vzor === PRAZDNY_CENIK ? (studio?.name ?? vzor.nadpis) : vzor.nadpis,
      podnadpis: vzor.podnadpis,
      platnostDo: vzor.platnostDo ? new Date(`${vzor.platnostDo}T00:00:00Z`) : null,
      mena: vzor.mena,
      sloupec1: vzor.sloupec1,
      sloupec1Popis: vzor.sloupec1Popis,
      sloupec2: vzor.sloupec2,
      sloupec2Popis: vzor.sloupec2Popis,
      poznamka: vzor.poznamka,
      radky: {
        create: vzor.radky.map((r, i) => ({ ...r, poradi: i })),
      },
    },
    include: { radky: { orderBy: { poradi: 'asc' } } },
  });
  return doTvaru(vytvoreny);
}

/**
 * Tvar, ve kterém ceník chodí z databáze. `radky` je nepovinné jen kvůli
 * typové kontrole: stub Prisma klienta (stubs/prisma-client.d.ts) relace
 * neumí, takže z `include` o nich neví. Ve skutečnosti se sem ceník bez řádků
 * nedostane - všechna volání mají `include: { radky: … }`.
 */
type CenikZDb = {
  id: string;
  nadpis: string;
  podnadpis: string | null;
  platnostDo: Date | null;
  mena: Currency;
  sloupec1: string;
  sloupec1Popis: string | null;
  sloupec2: string | null;
  sloupec2Popis: string | null;
  poznamka: string | null;
  radky?: {
    id: string;
    popis: string;
    cena1Minor: number | null;
    cena2Minor: number | null;
    od1: boolean;
    od2: boolean;
  }[];
};

function doTvaru(c: CenikZDb): Cenik & { id: string } {
  return {
    id: c.id,
    nadpis: c.nadpis,
    podnadpis: c.podnadpis,
    platnostDo: doIso(c.platnostDo),
    mena: c.mena,
    sloupec1: c.sloupec1,
    sloupec1Popis: c.sloupec1Popis,
    sloupec2: c.sloupec2,
    sloupec2Popis: c.sloupec2Popis,
    poznamka: c.poznamka,
    radky: (c.radky ?? []).map(
      (r): RadekCeniku => ({
        id: r.id,
        popis: r.popis,
        cena1Minor: r.cena1Minor,
        cena2Minor: r.cena2Minor,
        od1: r.od1,
        od2: r.od2,
      }),
    ),
  };
}

/**
 * Uložení celého ceníku najednou.
 *
 * Řádky se SMAŽOU A ZALOŽÍ ZNOVU, ne párují po id: ceník má pár řádků, jejich
 * pořadí se přehazuje a párovat je proti sobě by znamenalo trojí porovnávání
 * kvůli tabulce o pěti řádcích. Na nic se z řádků neodkazuje, takže se nová id
 * nemají kde projevit.
 */
export async function ulozCenik(
  studioId: string,
  data: Omit<Cenik, 'radky'> & { radky: Omit<RadekCeniku, 'id'>[] },
  kdo: { id: string; jmeno: string | null },
): Promise<Cenik & { id: string }> {
  const cenik = await zajistiCenik(studioId);

  const ulozeny = await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.studioCenikRadek.deleteMany({ where: { cenikId: cenik.id } });
    return tx.studioCenik.update({
      where: { id: cenik.id },
      data: {
        nadpis: data.nadpis,
        podnadpis: data.podnadpis || null,
        platnostDo: data.platnostDo ? new Date(`${data.platnostDo}T00:00:00Z`) : null,
        mena: data.mena,
        sloupec1: data.sloupec1,
        sloupec1Popis: data.sloupec1Popis || null,
        sloupec2: data.sloupec2 || null,
        sloupec2Popis: data.sloupec2Popis || null,
        poznamka: data.poznamka || null,
        upravilId: kdo.id,
        upravilJmeno: kdo.jmeno,
        radky: { create: data.radky.map((r, i) => ({ ...r, poradi: i })) },
      },
      include: { radky: { orderBy: { poradi: 'asc' } } },
    });
  });

  return doTvaru(ulozeny);
}
