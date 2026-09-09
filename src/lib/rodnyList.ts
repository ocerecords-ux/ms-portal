/**
 * Rodný list (RL) k reklamnímu spotu - zadání 9. 9. 2026.
 *
 * Tenhle soubor je ZÁMĚRNĚ bez Prismy a bez přístupu do databáze, aby se dal
 * importovat i v prohlížeči (formulář na detailu projektu) - stejné dělení
 * jako u kalendáře (calendar.ts / calendarServer.ts) nebo smluv.
 *
 * Co je RL: jednostránkové PDF „RODNÝ LIST" s údaji o spotu, které se
 * automaticky vyrobí ve chvíli, kdy projekt reklamního klienta přejde
 * v Caflou do stavu „Dokončeno - ke schválení". Vykreslení řeší
 * rodnyListPdf.ts, celý běh (kdy, komu, kam) pak rodnyListServer.ts.
 */

/** Stav v Caflou, který spouští vytvoření RL. */
export const RL_TRIGGER_STATUS = 'Dokončeno - ke schválení';

/** Stav bez diakritiky a interpunkce - ať porovnání přežije překlepy a „#2". */
function normalizeStatus(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/#\s*\d+\s*$/, '')
    .replace(/[^a-z0-9]+/g, '');
}

const TRIGGER_KEY = normalizeStatus(RL_TRIGGER_STATUS);

/** Je tohle ten stav, při přechodu do kterého se má RL vyrobit? */
export function isRodnyListTriggerStatus(statusName: string | null | undefined): boolean {
  if (!statusName) return false;
  return normalizeStatus(statusName) === TRIGGER_KEY;
}

// ---------------------------------------------------------------------------
// Údaje, ze kterých RL vzniká
// ---------------------------------------------------------------------------

/**
 * Hodnoty vedené u projektu (model ProjectMeta). Do PDF se nesmí nic zapsat
 * natvrdo - všechno se bere odsud, respektive z karty firmy.
 */
export type RodnyListFields = {
  /** Název spotu; když je prázdný, použije se název projektu z Caflou. */
  spotName: string;
  /** Délka spotu v sekundách - v dokumentu se zobrazí jako „20s". */
  spotLengthSeconds: number | null;
  /** Kdo spot režíroval. */
  directorName: string;
  /** Sekce „Hudba ve spotu" - jen tahle dvě pole, nic dalšího. */
  musicTitle: string;
  musicAuthor: string;
  /** Spot hudbu nemá - pak se hudební pole nevyžadují a RL nelže. */
  noMusic: boolean;
  /** Datum výroby - jen datum, bez času. */
  productionDate: Date | null;
};

export const RODNY_LIST_LABELS = {
  clientName: 'Název klienta',
  spotName: 'Název spotu',
  spotLengthSeconds: 'Délka spotu',
  directorName: 'Režie',
  musicTitle: 'Název skladby',
  musicAuthor: 'Autor hudby',
  productionDate: 'Datum výroby',
} as const;

/**
 * Co ještě chybí, aby šel RL vyrobit. Vrací rovnou lidské popisky polí, ať se
 * dají vypsat uživateli i vložit do chybové hlášky beze změny.
 *
 * Výjimka podle zadání: projekt bez hudby. Když je zaškrtnuté „spot nemá
 * hudbu", hudební pole se nevyžadují a do PDF se nedostane vymyšlený údaj.
 */
export function missingRodnyListFields(
  input: RodnyListFields & { clientName: string },
): string[] {
  const chybi: string[] = [];
  if (!input.clientName.trim()) chybi.push(RODNY_LIST_LABELS.clientName);
  if (!input.spotName.trim()) chybi.push(RODNY_LIST_LABELS.spotName);
  if (input.spotLengthSeconds == null || input.spotLengthSeconds <= 0) {
    chybi.push(RODNY_LIST_LABELS.spotLengthSeconds);
  }
  if (!input.directorName.trim()) chybi.push(RODNY_LIST_LABELS.directorName);
  if (!input.productionDate) chybi.push(RODNY_LIST_LABELS.productionDate);
  if (!input.noMusic) {
    if (!input.musicTitle.trim()) chybi.push(RODNY_LIST_LABELS.musicTitle);
    if (!input.musicAuthor.trim()) chybi.push(RODNY_LIST_LABELS.musicAuthor);
  }
  return chybi;
}

/** Hláška pro uživatele, když RL nejde vyrobit. */
export function missingFieldsMessage(missing: string[]): string {
  return `Rodný list nejde vytvořit — u projektu chybí: ${missing.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Formátování hodnot do dokumentu
// ---------------------------------------------------------------------------

/** Délka spotu tak, jak je ve vzoru: „20s". */
export function formatSpotLength(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '';
  return `${Math.round(seconds)}s`;
}

/** Datum výroby ve tvaru „24.08.2026" (stejně jako ve vzorovém PDF). */
export function formatProductionDate(date: Date | null | undefined): string {
  if (!date) return '';
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

/**
 * Co se v dokumentu objeví v řádcích o hudbě. U spotu bez hudby se do RL
 * NESMÍ dostat falešný údaj - proto se napíše rovnou, že spot hudbu nemá.
 */
export function musicLines(input: Pick<RodnyListFields, 'musicTitle' | 'musicAuthor' | 'noMusic'>): {
  title: string;
  author: string;
} {
  if (input.noMusic) return { title: 'Spot bez hudby', author: '—' };
  return { title: input.musicTitle.trim(), author: input.musicAuthor.trim() };
}

/**
 * Bezpečný název souboru „RL_[nazev_spotu].pdf".
 *
 * Diakritika se převádí na základní písmena a mezery na podtržítka schválně -
 * soubor putuje na Google Disk, do S3 i do hlavičky Content-Disposition
 * a s háčky a mezerami se v některém z těch míst vždycky něco rozbije.
 */
export function rodnyListFileName(spotName: string): string {
  const zaklad = spotName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `RL_${zaklad || 'spot'}.pdf`;
}

/** Popisek verze pro seznam v portálu. */
export function rodnyListVersionLabel(version: number): string {
  return version <= 1 ? 'verze 1' : `verze ${version}`;
}
