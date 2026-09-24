import { prisma } from '@/lib/db';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';

/**
 * POŘADÍ STAVŮ V PŘEHLEDU (zadání 24. 9. 2026: „potřebuju, abych si mohl
 * uspořádat projekty v přehledu podle stavu, ale abychom mohli ovlivnit
 * pořadí, jaký stav bude na jakém místě").
 *
 * Kliknutí na sloupec Stav do teď řadilo ABECEDNĚ - „Dokončeno" před
 * „Natáčíme", i když projekt jde opačně. Teď se řadí podle pořadí, které si
 * tým nastaví; výchozí je cesta projektu z lib/stavyProjektu.ts.
 *
 * JEN ŘAZENÍ V TABULCE. Nabídka stavů u projektu, „odevzdáno" ani nic dalšího
 * se tím neřídí - ta pravidla zůstávají v kódu. Přetažení v přehledu má měnit
 * pohled, ne chování portálu.
 *
 * CO V SEZNAMU NENÍ, JDE NA KONEC v pořadí cesty projektu - nový stav se tedy
 * objeví hned a nikdo ho nemusí nikam dopisovat. Staré stavy z Caflou končí
 * úplně vzadu, abecedně mezi sebou.
 */

const VYCHOZI = STAVY_PROJEKTU.map((s) => s.nazev);

/** Stavy v pořadí, ve kterém se mají v přehledu řadit. */
export async function nactiPoradiStavu(): Promise<string[]> {
  try {
    const radky = await prisma.poradiStavu.findMany({ orderBy: { poradi: 'asc' } });
    const ulozene = radky.map((r) => r.nazev).filter((n) => VYCHOZI.includes(n));
    if (ulozene.length === 0) return VYCHOZI;
    // Co přibylo v kódu po posledním uložení, se přidá na konec.
    return [...ulozene, ...VYCHOZI.filter((n) => !ulozene.includes(n))];
  } catch (err) {
    console.error('Cteni poradi stavu selhalo:', err);
    return VYCHOZI;
  }
}

/**
 * Uložit nové pořadí. Bere jen stavy z naší cesty projektu a doplní ty, které
 * ve vstupu chybí - v tabulce se pak nemá kde ztratit ani jeden.
 */
export async function ulozPoradiStavu(nazvy: string[]): Promise<string[]> {
  const cisty = nazvy.filter((n, i) => VYCHOZI.includes(n) && nazvy.indexOf(n) === i);
  const vysledek = [...cisty, ...VYCHOZI.filter((n) => !cisty.includes(n))];

  await prisma.$transaction([
    prisma.poradiStavu.deleteMany({}),
    prisma.poradiStavu.createMany({
      data: vysledek.map((nazev, i) => ({ nazev, poradi: i })),
    }),
  ]);

  return vysledek;
}
