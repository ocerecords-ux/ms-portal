import type { ProjectPriority } from '@prisma/client';

/**
 * Tvar projektu pro zobrazení — bez jakékoliv vazby na Caflou.
 *
 * Do 11. 9. 2026 tyhle typy bydlely v `lib/caflou.ts`, protože projekt se při
 * každém zobrazení četl z Caflou. Od odpojení Caflou je projekt náš: žije
 * v tabulce ProjectMeta a čte se z databáze. Typy proto patří sem a Caflou si
 * je bere odsud (potřebuje je už jen jednorázový přenos).
 *
 * Klíč `id` zůstal číslo a pořád se mu říká `caflouProjectId`. Není to
 * nedbalost: na tohle ID se odkazují doklady, výkazy, rozpočty i rodné listy
 * a přečíslovat je by znamenalo rozbít všechny ty vazby kvůli názvu.
 */
export type DisplayProject = {
  id: number;
  name: string;
  /**
   * Dokončený projekt. Dřív to byl příznak z Caflou, teď vlastní sloupec —
   * přehazuje se ručně spolu se stavem (viz lib/stavyProjektu.ts).
   */
  finished: boolean;
  statusName: string;
  priority: ProjectPriority | null;
  narrator: string | null;
  pageCount: number | null;
  finishedAt: Date | null;
  releaseDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  /**
   * Kdo byl u projektu v Caflou napsaný jako objednávající — Caflou to drželo
   * ve štítcích. Zůstává jen u projektů, které přišly přenosem, a slouží jako
   * vodítko, dokud projekt nemá vyplněného klienta (ProjectMeta.klientUserId).
   */
  clientTag: string | null;
  /**
   * Herci projektu pro bublinu v přehledu (zadání 12. 9. 2026: „pojďme
   * stejný princip s bublinama udělat i v tom klientském přehledu").
   *
   * Nepovinné: starší volající to neposílají a pak se ukáže jméno z pole
   * `narrator` jako obyčejný text, jako dosud. Hlavní herec je první.
   */
  herci?: { jmeno: string }[];
};

export type AdminDisplayProject = DisplayProject & {
  companyName: string;
  /** Jen pro dohledání ve starých datech; portál podle toho nic neřídí. */
  caflouCompanyId: string | null;
};

/** Řádek z ProjectMeta, ze kterého se projekt pro zobrazení skládá. */
export type ProjektZDatabaze = {
  caflouProjectId: string;
  name: string | null;
  statusName: string | null;
  finished: boolean;
  priority: ProjectPriority | null;
  narrator: string | null;
  pageCount: number | null;
  releaseDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  klientName: string | null;
  companyName: string | null;
  /** Navázaná firma, když se dotáhla; jinak stačí `companyName` textem. */
  company?: { name: string; caflouCompanyId: string | null } | null;
};

/** Převede řádek z databáze na projekt k zobrazení. */
export function projektZMeta(m: ProjektZDatabaze): AdminDisplayProject {
  return {
    id: Number(m.caflouProjectId),
    name: m.name ?? '',
    finished: m.finished,
    statusName: m.statusName ?? '',
    priority: m.priority,
    narrator: m.narrator,
    pageCount: m.pageCount,
    // Konec projektu je zaroven datum dokonceni - vlastni sloupec uz nemame.
    finishedAt: m.endDate,
    releaseDate: m.releaseDate,
    startDate: m.startDate,
    endDate: m.endDate,
    clientTag: m.klientName,
    companyName: m.company?.name ?? m.companyName ?? '',
    caflouCompanyId: m.company?.caflouCompanyId ?? null,
  };
}


