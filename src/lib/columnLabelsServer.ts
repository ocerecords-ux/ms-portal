import { prisma } from '@/lib/db';
import { mergeLabels, type ColumnLabels } from '@/lib/columnLabels';

// Serverova cast vlastnich nazvu sloupcu - oddelena od lib/columnLabels.ts,
// protoze konstanty odtamtud pouzivaji i klientske komponenty.

/**
 * Prepisy, ktere jsou ve skutecnosti jen STARY VYCHOZI nazev. Kdyz se v
 * editoru sloupcu (tri tecky) klikne na Hotovo, ulozi se vsechny nazvy tak,
 * jak zrovna jsou - vcetne tech nezmenenych. Pozdejsi zmena vychoziho nazvu
 * v kodu se pak neprojevi, protoze ji prekryje ulozeny prepis se starym
 * textem (zprava uzivatele 8. 9. 2026: "mam tam i stare pole Manazer u
 * projektu a ne Manazer projektu"). Takove radky pri nacteni zahodime -
 * jednou provzdy a jen presnou shodu, takze vlastni pojmenovani zustava.
 */
const OUTDATED_LABELS: Record<string, string[]> = {
  managerName: ['Manažer'],
  endDate: ['Dokončeno'],
};

/** Nazvy sloupcu pro tabulku: vychozi prekryte tim, co je ulozene. */
export async function loadColumnLabels(tableKey: string): Promise<ColumnLabels> {
  try {
    const rows = await prisma.columnLabel.findMany({ where: { tableKey } });

    const zastarale = rows.filter((r) => (OUTDATED_LABELS[r.columnKey] ?? []).includes(r.label));
    if (zastarale.length > 0) {
      await prisma.columnLabel.deleteMany({ where: { id: { in: zastarale.map((r) => r.id) } } });
    }
    const platne = rows.filter((r) => !zastarale.some((z) => z.id === r.id));

    return mergeLabels(tableKey, Object.fromEntries(platne.map((r) => [r.columnKey, r.label])));
  } catch (err) {
    // Databaze bez tabulky ColumnLabel (jeste nedobehl `prisma db push`)
    // nesmi shodit stranku - proste se pouziji vychozi nazvy.
    console.error('Nacteni nazvu sloupcu selhalo, pouzivam vychozi:', err);
    return mergeLabels(tableKey, {});
  }
}
