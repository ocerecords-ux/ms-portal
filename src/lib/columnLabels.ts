/**
 * Nastavení sloupců v tabulkách (zadání 8. 9. 2026, rozšířeno 9. 9. 2026:
 * „když chceme upravit názvy sloupců u projektu, udělejme to stejně jako
 * v hlavním menu").
 *
 * Stejně jako lišta nahoře se sloupce dají přejmenovat, přetáhnout do jiného
 * pořadí a křížkem odebrat. Výchozí podoba zůstává v kódu, v databázi je jen
 * to, co si někdo nastavil — takže když do tabulky přibude sloupec, objeví se
 * sám (na konci) a „Obnovit výchozí" znamená prostě uložené nastavení smazat.
 *
 * Bez přístupu do databáze, aby to šlo použít i v klientských komponentách.
 */

/** Jeden sloupec tak, jak se má vykreslit. */
export type ColumnSetting = {
  key: string;
  label: string;
  hidden: boolean;
};

/** Co je o sloupci uložené. Prázdný `label` = ponechat výchozí název. */
export type StoredColumn = {
  columnKey: string;
  label: string;
  hidden: boolean;
  sortOrder: number;
};

/** Interní přehled projektů - jediná tabulka, která to zatím používá. */
export const PROJECTS_TABLE_KEY = 'projekty-interni';

export const DEFAULT_COLUMN_LABELS: Record<string, { key: string; label: string }[]> = {
  [PROJECTS_TABLE_KEY]: [
    { key: 'name', label: 'Název projektu' },
    { key: 'companyName', label: 'Firma' },
    { key: 'statusName', label: 'Stav' },
    { key: 'priority', label: 'Priorita' },
    { key: 'projectType', label: 'Typ projektu' },
    { key: 'managerName', label: 'Manažer projektu' },
    // Herec patri do zakladniho prehledu (zadani 10. 9. 2026) - u audioknihy
    // je to prvni vec, ktera se u projektu hleda.
    { key: 'narrator', label: 'Herec' },
    { key: 'pageCount', label: 'Počet NS' },
    // "Konec" z Caflou; "Datum vydání" je náš vlastní sloupec v Caflou
    // (zadani 8. 9. 2026).
    { key: 'endDate', label: 'Datum dokončení' },
    { key: 'releaseDate', label: 'Datum vydání' },
  ],
};

/** Výchozí názvy jako mapa klíč → název. */
export function defaultLabelsFor(tableKey: string): Record<string, string> {
  const columns = DEFAULT_COLUMN_LABELS[tableKey] ?? [];
  return Object.fromEntries(columns.map((c) => [c.key, c.label]));
}

/** Výchozí podoba tabulky - všechny sloupce, v pořadí z kódu, nic skryté. */
export function defaultColumns(tableKey: string): ColumnSetting[] {
  return (DEFAULT_COLUMN_LABELS[tableKey] ?? []).map((c) => ({ ...c, hidden: false }));
}

/**
 * Výchozí sloupce překryté tím, co je uložené.
 *
 * Sloupec, ke kterému nic uloženého není (nový v kódu), si nechá výchozí název
 * a zařadí se za všechny nastavené - ať se po přidání do kódu objeví sám a
 * nikdo si nemusí vzpomenout, že ho má někde zapnout.
 */
export function mergeColumns(tableKey: string, stored: StoredColumn[]): ColumnSetting[] {
  const defaults = DEFAULT_COLUMN_LABELS[tableKey] ?? [];
  const podleKlice = new Map(stored.map((s) => [s.columnKey, s]));

  /**
   * Uložené pořadí se použije, jen když je uložený KOMPLETNÍ seznam sloupců.
   *
   * Starší verze ukládala řádek jen pro přejmenované sloupce a všem dávala
   * sortOrder 0. Kdyby se takové pořadí bralo vážně, vyskočil by přejmenovaný
   * sloupec na začátek tabulky (chyba 9. 9. 2026: první byl "NS" místo názvu
   * projektu). Neúplné nastavení tedy řeší jen názvy a skrytí, pořadí zůstává
   * z kódu - a první uložení novou verzí to samo srovná.
   */
  const maPoradi = defaults.length > 0 && defaults.every((c) => podleKlice.has(c.key));

  return defaults
    .map((sloupec, index) => {
      const ulozene = podleKlice.get(sloupec.key);
      return {
        key: sloupec.key,
        label: ulozene?.label?.trim() ? ulozene.label.trim() : sloupec.label,
        hidden: ulozene?.hidden ?? false,
        poradi: maPoradi && ulozene ? ulozene.sortOrder : index,
      };
    })
    .sort((a, b) => a.poradi - b.poradi)
    .map(({ key, label, hidden }) => ({ key, label, hidden }));
}

/** Jen viditelné sloupce, v pořadí. */
export function visibleColumns(columns: ColumnSetting[]): ColumnSetting[] {
  return columns.filter((c) => !c.hidden);
}

/** Zpětná kompatibilita: mapa klíč → název pro místa, kde stačí jen názvy. */
export function labelsOf(columns: ColumnSetting[]): Record<string, string> {
  return Object.fromEntries(columns.map((c) => [c.key, c.label]));
}
