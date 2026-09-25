import { prisma } from '@/lib/db';
import { expenseTotalMinor, jeUhrazeno } from '@/lib/expenses';

/**
 * Dopočet příznaku `paid` z jednotlivých úhrad (zadání 25. 9. 2026: „potřebuji
 * u výdajů přidávat částečnou úhradu… abych tam měl záznam, kolik ještě zbývá
 * doplatit").
 *
 * Volá se po každém zápisu i smazání úhrady. Doklad je uhrazený, teprve když
 * součet úhrad dosáhne částky s DPH; `paidAt` je datum té poslední, kterou se
 * dorovnal — ne okamžik, kdy to někdo naťukal do portálu.
 *
 * KDYŽ SE SMAŽE POSLEDNÍ ÚHRADA, doklad se vrací mezi neuhrazené. To je
 * schválně: řádky úhrad jsou od té chvíle jediná pravda a tichý `paid: true`
 * bez jediné koruny by lhal.
 */
export async function prepocitejUhradu(expenseId: string): Promise<{
  celkemMinor: number;
  uhrazenoMinor: number;
  zbyvaMinor: number;
  paid: boolean;
}> {
  const doklad = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      amountExVatMinor: true,
      vatRate: true,
      uhrady: { orderBy: { datum: 'asc' }, select: { castkaMinor: true, datum: true } },
    },
  });
  if (!doklad) throw new Error('Doklad neexistuje.');

  const celkemMinor = expenseTotalMinor(doklad.amountExVatMinor, doklad.vatRate);
  const uhrazeno = doklad.uhrady.reduce((soucet, u) => soucet + u.castkaMinor, 0);
  const paid = doklad.uhrady.length > 0 && jeUhrazeno(celkemMinor, uhrazeno);

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      paid,
      paidAt: paid ? doklad.uhrady[doklad.uhrady.length - 1].datum : null,
    },
  });

  return {
    celkemMinor,
    uhrazenoMinor: uhrazeno,
    zbyvaMinor: Math.max(0, celkemMinor - uhrazeno),
    paid,
  };
}
