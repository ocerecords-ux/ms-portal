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
    // TYP PROJEKTU ANI MANAZER TU NEJSOU (zadani 13. 9. 2026: „manazera
    // projektu bych na hlavni strance nezobrazoval, jen v detailu" a „dejme
    // z prehledu i typ projektu, to tam taky nevejde a navic je tam napoveda
    // v tech ikonach pred nazvem").
    //
    // Typ uz nese ikona pred nazvem projektu - ma nazev typu v bublinkove
    // napovede (viz IkonaTypu), takze sloupec rikal totez podruhe a bral
    // sirku, ktera chybela nazvum. Manazera resi az ten, kdo projekt otevre.
    //
    // Odebranim ODSUD zmizi sloupec i z uz ulozeneho nastaveni: mergeColumns
    // prochazi vychozi seznam, takze co tu neni, se nevykresli. Vykreslovani
    // obou sloupcu zustava v shared.tsx - vratit je znamena dopsat sem radek.
    // Herec patri do zakladniho prehledu (zadani 10. 9. 2026) - u audioknihy
    // je to prvni vec, ktera se u projektu hleda.
    { key: 'narrator', label: 'Herec' },
    { key: 'pageCount', label: 'Počet NS' },
    // "Konec" z Caflou; "Datum vydání" je náš vlastní sloupec v Caflou
    // (zadani 8. 9. 2026).
    { key: 'endDate', label: 'Datum dokončení' },
    { key: 'releaseDate', label: 'Datum vydání' },
    // Slozka projektu na Disku - v prehledu jako tlacitko (zadani 10. 9. 2026).
    { key: 'driveUrl', label: 'Odkaz na KZ' },
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

// ---------------------------------------------------------------------------
// Vlastní sloupce podle člověka a zařízení (zadání 19. 9. 2026: „a taky to,
// jaké se mi zobrazují sloupce v přehledu projektu" - jinak v mobilu a jinak
// na počítači).
//
// Názvy sloupců jsou SPOLEČNÉ (výše, mění je Žůžo-labůžo). Každý si k nim
// nastavuje jen pořadí a co vidí - zvlášť pro počítač a pro mobil.
// ---------------------------------------------------------------------------

/**
 * Co se ukáže v mobilu tomu, kdo si mobil ještě nenastavil (zadání
 * 14. 9. 2026: „nechal bych tam jen název projektu, datum odevzdání a stav").
 */
export const VYCHOZI_SLOUPCE_MOBIL: Record<string, string[]> = {
  [PROJECTS_TABLE_KEY]: ['name', 'endDate', 'statusName'],
};

/** Uložené nastavení jednoho člověka pro jedno zařízení. */
export type VlastniSloupec = { columnKey: string; sortOrder: number; hidden: boolean };

/**
 * Sloupce pro zařízení: společné názvy, pořadí a viditelnost podle toho, co
 * si člověk uložil. Bez uloženého nastavení platí na počítači společná
 * podoba tabulky a v mobilu jen pár základních sloupců.
 *
 * Sloupec, který přibyl do kódu až po uložení, se přidá na konec - na
 * počítači zobrazený (ať se objeví sám), v mobilu schovaný (ať nerozbije
 * úzkou tabulku).
 */
export function sloupceProZarizeni(
  tableKey: string,
  spolecne: ColumnSetting[],
  ulozene: VlastniSloupec[],
  zarizeni: 'POCITAC' | 'MOBIL',
): ColumnSetting[] {
  if (ulozene.length === 0) {
    if (zarizeni === 'POCITAC') return spolecne;
    const zaklad = VYCHOZI_SLOUPCE_MOBIL[tableKey] ?? spolecne.map((c) => c.key);
    const vybrane = zaklad
      .map((klic) => spolecne.find((c) => c.key === klic))
      .filter((c): c is ColumnSetting => Boolean(c))
      .map((c) => ({ ...c, hidden: false }));
    const zbytek = spolecne.filter((c) => !zaklad.includes(c.key)).map((c) => ({ ...c, hidden: true }));
    return [...vybrane, ...zbytek];
  }

  const podleKlice = new Map(ulozene.map((u) => [u.columnKey, u]));
  const znama = spolecne
    .filter((c) => podleKlice.has(c.key))
    .map((c) => ({ ...c, hidden: podleKlice.get(c.key)!.hidden, poradi: podleKlice.get(c.key)!.sortOrder }))
    .sort((a, b) => a.poradi - b.poradi)
    .map(({ key, label, hidden }) => ({ key, label, hidden }));
  const nove = spolecne
    .filter((c) => !podleKlice.has(c.key))
    .map((c) => ({ ...c, hidden: zarizeni === 'MOBIL' ? true : c.hidden }));
  const vysledek = [...znama, ...nove];
  // Kdyby vsechno zbylo skryte (treba se sloupec prejmenoval v kodu), radsi
  // ukazat vychozi podobu nez prazdnou tabulku.
  return vysledek.some((c) => !c.hidden) ? vysledek : sloupceProZarizeni(tableKey, spolecne, [], zarizeni);
}
