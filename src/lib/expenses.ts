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
