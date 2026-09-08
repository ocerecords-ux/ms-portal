/**
 * Vlastní názvy sloupců v tabulkách (zadani 8. 9. 2026).
 *
 * Výchozí názvy zůstávají v kódu, v databázi je jen to, co si někdo
 * přejmenoval. Když do tabulky přibude sloupec, funguje sám od sebe — a
 * "Obnovit výchozí" znamená prostě smazat uložené přepisy.
 *
 * Bez přístupu do databáze, aby to šlo použít i v klientských komponentách.
 */

export type ColumnLabels = Record<string, string>;

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
    { key: 'pageCount', label: 'Normostrany' },
    // "Konec" z Caflou; "Datum vydání" je náš vlastní sloupec v Caflou
    // (zadani 8. 9. 2026).
    { key: 'endDate', label: 'Datum dokončení' },
    { key: 'releaseDate', label: 'Datum vydání' },
  ],
};

/** Výchozí názvy jako mapa klíč → název. */
export function defaultLabelsFor(tableKey: string): ColumnLabels {
  const columns = DEFAULT_COLUMN_LABELS[tableKey] ?? [];
  return Object.fromEntries(columns.map((c) => [c.key, c.label]));
}

/** Výchozí názvy překryté tím, co si uživatel uložil. */
export function mergeLabels(tableKey: string, overrides: ColumnLabels): ColumnLabels {
  const defaults = defaultLabelsFor(tableKey);
  const merged: ColumnLabels = { ...defaults };
  for (const [key, label] of Object.entries(overrides)) {
    if (key in defaults && label.trim()) merged[key] = label.trim();
  }
  return merged;
}
