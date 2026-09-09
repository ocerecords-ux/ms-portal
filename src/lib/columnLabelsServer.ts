import { prisma } from '@/lib/db';
import { mergeColumns, defaultColumns, type ColumnSetting } from '@/lib/columnLabels';

// Serverova cast nastaveni sloupcu - oddelena od lib/columnLabels.ts,
// protoze konstanty odtamtud pouzivaji i klientske komponenty.

/**
 * Prepisy, ktere jsou ve skutecnosti jen STARY VYCHOZI nazev. Kdyz se
 * v editoru sloupcu (tri tecky) klikne na Hotovo, ulozi se i sloupce, kterym
 * nikdo nazev nemenil. Pozdejsi zmena vychoziho nazvu v kodu by se pak
 * neprojevila, protoze ji prekryje ulozeny prepis se starym textem (zprava
 * uzivatele 8. 9. 2026: "mam tam i stare pole Manazer u projektu a ne Manazer
 * projektu"). Takove nazvy pri nacteni zahodime - jen presnou shodu, takze
 * vlastni pojmenovani zustava.
 *
 * Od 9. 9. 2026 uz se nezmeneny nazev ukládá jako prazdny retezec, takze
 * tenhle seznam resi jen radky ulozene starsi verzi.
 */
const OUTDATED_LABELS: Record<string, string[]> = {
  managerName: ['Manažer'],
  endDate: ['Dokončeno'],
};

/**
 * Sloupce tabulky: vychozi podoba prekryta tim, co je ulozene (nazev, poradi,
 * skryti). Kdyz se nastaveni nepodari nacist, vrati se vychozi - tabulka se
 * musi ukazat vzdycky.
 */
export async function loadColumnSettings(tableKey: string): Promise<ColumnSetting[]> {
  try {
    const rows = await prisma.columnLabel.findMany({
      where: { tableKey },
      orderBy: { sortOrder: 'asc' },
    });

    const zastarale = rows.filter((r) => (OUTDATED_LABELS[r.columnKey] ?? []).includes(r.label));
    if (zastarale.length > 0) {
      await prisma.columnLabel.updateMany({
        where: { id: { in: zastarale.map((r) => r.id) } },
        data: { label: '' },
      });
    }

    return mergeColumns(
      tableKey,
      rows.map((r) => ({
        columnKey: r.columnKey,
        label: zastarale.some((z) => z.id === r.id) ? '' : r.label,
        hidden: r.hidden,
        sortOrder: r.sortOrder,
      })),
    );
  } catch (err) {
    // Databaze bez novych sloupcu (jeste nedobehl `prisma db push`) nesmi
    // shodit stranku - proste se pouzije vychozi podoba tabulky.
    console.error('Nacteni nastaveni sloupcu selhalo, pouzivam vychozi:', err);
    return defaultColumns(tableKey);
  }
}
