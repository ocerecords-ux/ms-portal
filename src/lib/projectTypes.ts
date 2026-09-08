import type { ProjectPriority } from '@prisma/client';

/**
 * Ciselniky pro interni atributy projektu (viz model ProjectMeta v
 * schema.prisma) - zadani 5. 9. 2026.
 */

export const PRIORITY_OPTIONS: ProjectPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  LOW: 'Nízká',
  MEDIUM: 'Střední',
  HIGH: 'Vysoká',
};

/** Barvy stitku priority v prehledu i na detailu projektu. */
export const PRIORITY_CLASSES: Record<ProjectPriority, string> = {
  LOW: 'bg-[#EEF2F7] text-[#5B6472]',
  MEDIUM: 'bg-[#FDF1DE] text-status-progress',
  HIGH: 'bg-[#FDE4E4] text-[#C22B2B]',
};

/**
 * Typ projektu uz NENI pevny seznam v kodu - od 5. 9. 2026 se bere z Ceniku
 * (model PriceListItem, viz lib/priceList.ts): "to, co máme v seznamu ceníku,
 * bude sloužit i jako typ projektu". V ProjectMeta.projectType je ulozeny
 * primo nazev polozky, takze zustane citelny i po vyrazeni z ceniku.
 */
export function projectTypeLabel(key: string | null | undefined): string | null {
  const value = key?.trim();
  return value ? value : null;
}

/**
 * Rozpracovanost projektu - kdy patri do zalozky "Aktivni" a kdy do
 * "Dokoncene" (zadani 8. 9. 2026: "Nesedi nam aktivni a ukoncene projekty,
 * napr. OODA 7, TRIOLA nebo ATMOS - EN MUTACE jsou v Caflou ukoncene, takze
 * na portalu maji byt v Dokoncenych").
 *
 * Caflou dava dva nezavisle signaly a NEDRZI je synchronizovane (overeno na
 * zivo 8. 9. 2026 pres /api/admin/caflou-debug?najdi=... nad celym uctem -
 * 703 projektu):
 *
 *   1) project_status_name - stitek workflow, ktery si tym prepina rucne
 *      ("V pripave" -> "Natacime" -> "Dokonceno - ke schvaleni" -> ...).
 *   2) finished - priznak, ze je projekt v Caflou UZAVRENY.
 *
 * Puvodne tu bylo napsane, ze priznak finished maji nastaveny vsechny
 * projekty a nenese tedy zadnou informaci. To NEPLATI: u stavu "Natacime" je
 * 32 projektu s finished a 17 bez nej, u "V pripave" 9 : 13. Prave ty
 * uzavrene projekty se zapomenutym stitkem "Natacime" byly duvodem, proc se
 * hotove veci ukazovaly jako aktivni.
 *
 * Pravidlo je proto: rozhoduje priznak `finished`, protoze presne podle nej
 * deli projekty i samotne Caflou (35 aktivnich / 668 ukoncenych, overeno
 * 8. 9. 2026). Seznamy stitku nize slouzi uz jen jako zaloha pro pripad, ze
 * priznak v odpovedi chybi.
 */

/** Stav bez diakritiky, mezer a interpunkce - at porovnani prezije preklepy a "#2". */
function normalizeStatus(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/#\s*\d+\s*$/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Stavy, ve kterych se na projektu jeste pracuje. */
export const ACTIVE_PROJECT_STATUSES: string[] = [
  'V přípravě',
  'Natáčíme',
  'Natáčíme/stříháme',
  'Čekáme na opravy',
  'Zapracovány opravy',
  'V realizaci',
];

/** Stavy, kterymi projekt v Caflou konci (i kdyz jeste neni uzavreny). */
export const FINISHED_PROJECT_STATUSES: string[] = [
  'Dokončeno - ke schválení',
  'Schváleno - k fakturaci',
  'Vyfakturováno',
  'Dokončeno',
  'Hotovo',
  'Ukončeno',
  'Zrušeno',
  'Stornováno',
];

const ACTIVE_SET = new Set(ACTIVE_PROJECT_STATUSES.map(normalizeStatus));
const FINISHED_SET = new Set(FINISHED_PROJECT_STATUSES.map(normalizeStatus));

export function isActiveProjectStatus(statusName: string | null | undefined): boolean {
  if (!statusName) return false;
  return ACTIVE_SET.has(normalizeStatus(statusName));
}

export function isFinishedProjectStatus(statusName: string | null | undefined): boolean {
  if (!statusName) return false;
  return FINISHED_SET.has(normalizeStatus(statusName));
}

/**
 * Vysledne zarazeni projektu.
 *
 * Rozhoduje priznak `finished` z Caflou - overeno 8. 9. 2026 porovnanim s
 * Caflou samotnym: podle nej je aktivnich 35 a ukoncenych 668 projektu, coz
 * presne odpovida poctu projektu s finished=false a finished=true. Stitek
 * (project_status_name) je tedy jen popisek workflow, ktery muze zustat na
 * "Natacime" i u davno uzavrene zakazky - a naopak "Dokonceno - ke schvaleni"
 * muze mit projekt, ktery Caflou porad vede jako aktivni (presne jeden takovy
 * v uctu je, a byl to rozdil 34/669 proti 35/668).
 *
 * Stitek se pouzije jen jako zaloha, kdyz priznak nedorazi (napr. jinak
 * tvarovana odpoved z detailu projektu).
 */
export function isProjectFinished(
  statusName: string | null | undefined,
  finishedFlag: unknown,
): boolean {
  if (finishedFlag === true || finishedFlag === 1 || finishedFlag === '1') return true;
  if (finishedFlag === false || finishedFlag === 0 || finishedFlag === '0') return false;
  return isFinishedProjectStatus(statusName);
}
