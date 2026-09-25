import { prisma } from '@/lib/db';

// Kategorie vydaju (zadani 6. 9. 2026, doplneno 8. 9. 2026 o moznost pridavat
// dalsi). Tyhle ctyri plus "Ostatní" jsou jen zacatek - ciselnik se plni v
// databazi a admin si ho rozsiruje sam.
export const DEFAULT_EXPENSE_CATEGORIES: { name: string; sortOrder: number }[] = [
  { name: 'Honoráře herců', sortOrder: 10 },
  { name: 'Studio a technika', sortOrder: 20 },
  { name: 'Doprava', sortOrder: 30 },
  { name: 'Software a služby', sortOrder: 40 },
  { name: 'Ostatní', sortOrder: 50 },
];

/** Pri prvnim otevreni Vydaju zalozime vychozi kategorie, at je z ceho vybirat. */
export async function ensureExpenseCategories(): Promise<void> {
  try {
    const count = await prisma.expenseCategory.count();
    if (count > 0) return;
    await prisma.expenseCategory.createMany({ data: DEFAULT_EXPENSE_CATEGORIES });
  } catch (err) {
    // Databaze bez tabulky (jeste nedobehl `prisma db push`) nesmi shodit stranku.
    console.error('Zalozeni kategorii vydaju selhalo:', err);
  }
}

/** Castka dokladu s DPH. Sazba 0 = bez DPH. */
export function expenseTotalMinor(amountExVatMinor: number, vatRate: number): number {
  return amountExVatMinor + Math.round((amountExVatMinor * vatRate) / 100);
}

export const EXPENSE_VAT_RATES = [21, 12, 0];

/**
 * ČÁSTEČNÉ ÚHRADY (zadání 25. 9. 2026: „potřebuji u výdajů přidávat částečnou
 * úhradu, když budu třeba smlouvu nebo fakturu proplácet na vícekrát, abych
 * tam měl záznam, kolik ještě zbývá doplatit").
 *
 * Jedna pravda pro celý portál: uhrazeno = součet zapsaných úhrad. Doklad,
 * který žádnou úhradu zapsanou nemá, se čte postaru podle `paid` - jinak by
 * se z tisíců starších uhrazených dokladů rázem staly neuhrazené.
 */
export type UhradaCastka = { castkaMinor: number };

export function uhrazenoMinor(
  uhrady: UhradaCastka[] | null | undefined,
  celkemMinor: number,
  paid: boolean,
): number {
  if (!uhrady || uhrady.length === 0) return paid ? celkemMinor : 0;
  return uhrady.reduce((soucet, u) => soucet + u.castkaMinor, 0);
}

/** Kolik ještě zbývá doplatit. Přeplatek se nevrací jako záporné číslo. */
export function zbyvaMinor(celkemMinor: number, uhrazeno: number): number {
  return Math.max(0, celkemMinor - uhrazeno);
}

/** Je doklad zaplacený? Haléřový přeplatek i doplatek na korunu se počítá. */
export function jeUhrazeno(celkemMinor: number, uhrazeno: number): boolean {
  return uhrazeno >= celkemMinor;
}

/** Stav úhrady pro odznak: nic / část / celé. */
export function stavUhrady(celkemMinor: number, uhrazeno: number): 'NIC' | 'CAST' | 'CELE' {
  if (uhrazeno <= 0) return 'NIC';
  return jeUhrazeno(celkemMinor, uhrazeno) ? 'CELE' : 'CAST';
}
