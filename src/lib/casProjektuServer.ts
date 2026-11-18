import { prisma } from '@/lib/db';
import { durationMinutes, toHours } from '@/lib/timesheets';
import { DEFAULT_BUDGET_SETTINGS, computeBudget, type BudgetSettingsValues } from '@/lib/budget';

/**
 * ČAS NAD KNIHOU - BEZ JEDINÉ KORUNY (zadání 17. 11. 2026: „zásadní to počítat
 * z těch hodin, abychom věděli, jestli nad tím zvukaři netráví zbytečně moc
 * času… hlavně zvukaři by neměli vidět vůbec do peněz - rozpočtu. To může jen
 * Peter. A neměli by vidět, jakou má kdo sazbu").
 *
 * PROČ ZVLÁŠTNÍ SOUBOR, KDYŽ ROZPOČET UŽ JEDEN MÁ: `projektPenizeServer.ts`
 * tahá sazby, doklady a náklady a načítá se jen tomu, kdo na peníze má právo.
 * Tenhle dotaz vybírá ZÁMĚRNĚ JEN minuty a druh práce - žádnou sazbu, žádnou
 * částku, žádné jméno. I kdyby se komponenta někde omylem vykreslila komukoli,
 * není v ní co prozradit.
 *
 * Plán v hodinách je pro všechny stejný: frekvence trvá čtyři hodiny Tomášovi
 * i komukoliv jinému. Proto je to jediné číslo, které jde poctivě srovnat mezi
 * knihami i mezi lidmi - na rozdíl od korun, kde se liší sazby a je v nich
 * rezerva.
 */

export type CasProjektu = {
  /** Kolik hodin by kniha měla zabrat podle normostran. */
  plan: number;
  /** Kolik se jich zapsalo - celkem a po druzích práce. */
  celkem: number;
  nataceni: number;
  strih: number;
  opravy: number;
  ostatni: number;
};

/** Součty hodin z už načtených výkazů - bez dalšího dotazu do databáze. */
export function soucetHodin(
  zapisy: { startMinutes: number; endMinutes: number; workType: string }[],
  plan: number,
): CasProjektu {
  const hodin = (druh?: string) =>
    zapisy
      .filter((z) => (druh ? z.workType === druh : true))
      .reduce((soucet, z) => soucet + toHours(durationMinutes(z.startMinutes, z.endMinutes)), 0);

  return {
    plan,
    celkem: hodin(),
    nataceni: hodin('RECORDING'),
    strih: hodin('EDITING'),
    opravy: hodin('REPAIRS'),
    ostatni: hodin('OTHER'),
  };
}

/**
 * Načte čas nad projektem pro toho, kdo na peníze právo NEMÁ (zvukař).
 * Kdo rozpočet vidí, má výkazy stejně už načtené - tomu stačí `soucetHodin`.
 */
export async function nactiCasProjektu(
  caflouProjectId: string,
  normostran: number,
): Promise<CasProjektu | null> {
  if (normostran <= 0) return null;
  try {
    const [nastaveni, zapisy] = await Promise.all([
      prisma.budgetSettings.findUnique({ where: { id: 'default' } }),
      prisma.timesheetEntry.findMany({
        where: { caflouProjectId },
        // JEN MINUTY A DRUH PRACE. Sazba se odsud nesmí dostat ven.
        select: { startMinutes: true, endMinutes: true, workType: true },
      }),
    ]);
    const settings: BudgetSettingsValues = nastaveni ?? DEFAULT_BUDGET_SETTINGS;
    return soucetHodin(zapisy, computeBudget(normostran, settings).plannedHours);
  } catch (err) {
    console.error('Cas nad projektem se nepodarilo nacist:', err);
    return null;
  }
}
