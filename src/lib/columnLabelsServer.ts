import { prisma } from '@/lib/db';
import { mergeColumns, defaultColumns, sloupceProZarizeni, type ColumnSetting } from '@/lib/columnLabels';

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
  // "NS" bylo moc krátké (zadání 9. 9. 2026: "NS změň na Počet NS").
  pageCount: ['NS', 'Normostrany'],
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

/**
 * Sloupce přihlášeného člověka pro počítač i pro mobil (zadání 19. 9. 2026).
 * Když se vlastní nastavení nepodaří načíst, platí výchozí podoba.
 */
export async function loadMojeSloupce(
  tableKey: string,
  userId: string,
): Promise<{ spolecne: ColumnSetting[]; pocitac: ColumnSetting[]; mobil: ColumnSetting[] }> {
  const spolecne = await loadColumnSettings(tableKey);
  let radky: { zarizeni: string; columnKey: string; sortOrder: number; hidden: boolean }[] = [];
  try {
    radky = await prisma.userColumnSetting.findMany({
      where: { userId, tableKey },
      select: { zarizeni: true, columnKey: true, sortOrder: true, hidden: true },
    });
  } catch (err) {
    console.error('Nacteni vlastnich sloupcu selhalo, pouzivam vychozi:', err);
  }
  return {
    spolecne,
    pocitac: sloupceProZarizeni(tableKey, spolecne, radky.filter((r) => r.zarizeni === 'POCITAC'), 'POCITAC'),
    mobil: sloupceProZarizeni(tableKey, spolecne, radky.filter((r) => r.zarizeni === 'MOBIL'), 'MOBIL'),
  };
}
