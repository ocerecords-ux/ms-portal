import { prisma } from '@/lib/db';
import { mergeLabels, type ColumnLabels } from '@/lib/columnLabels';

// Serverova cast vlastnich nazvu sloupcu - oddelena od lib/columnLabels.ts,
// protoze konstanty odtamtud pouzivaji i klientske komponenty.

/** Nazvy sloupcu pro tabulku: vychozi prekryte tim, co je ulozene. */
export async function loadColumnLabels(tableKey: string): Promise<ColumnLabels> {
  try {
    const rows = await prisma.columnLabel.findMany({ where: { tableKey } });
    return mergeLabels(tableKey, Object.fromEntries(rows.map((r) => [r.columnKey, r.label])));
  } catch (err) {
    // Databaze bez tabulky ColumnLabel (jeste nedobehl `prisma db push`)
    // nesmi shodit stranku - proste se pouziji vychozi nazvy.
    console.error('Nacteni nazvu sloupcu selhalo, pouzivam vychozi:', err);
    return mergeLabels(tableKey, {});
  }
}
