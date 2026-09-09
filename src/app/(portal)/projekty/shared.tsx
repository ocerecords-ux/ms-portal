import Link from 'next/link';
import type { ProjectPriority } from '@prisma/client';
import type { AdminDisplayProject, DisplayProject } from '@/lib/caflou';
import type { ColumnSetting } from '@/lib/columnLabels';
import { PRIORITY_CLASSES, PRIORITY_LABELS, projectTypeLabel } from '@/lib/projectTypes';

// Caflou pouziva interni nazvy stavu (napr. "Schváleno - k fakturaci"), ktere
// chceme klientovi v portalu zobrazovat srozumitelneji. Dalsi preklady stavu
// pripadne pridavej sem - vse ostatni se zobrazuje tak, jak prijde z Caflou.
const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  'Schváleno - k fakturaci': 'Dokončeno',
};

function displayStatusName(statusName: string): string {
  return STATUS_LABEL_OVERRIDES[statusName] ?? statusName;
}

export function formatDate(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('cs-CZ').format(d);
}

export function StatusPill({ finished, statusName }: { finished: boolean; statusName: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-heading font-semibold px-3 py-1 rounded-pill whitespace-nowrap ${
        finished ? 'bg-[#E3F9EC] text-status-done' : 'bg-[#FDF1DE] text-status-progress'
      }`}
    >
      {displayStatusName(statusName)}
    </span>
  );
}

export function ProjectsTable({
  projects,
  emptyText,
  rodneListy,
}: {
  projects: DisplayProject[];
  emptyText: string;
  /**
   * Rodné listy reklamních spotů podle ID projektu v Caflou (zadání 9. 9. 2026).
   * Když se prop nepředá, sloupec se vůbec nevykreslí - u audioknih nemá RL
   * smysl a klient, který reklamy nedělá, ho v přehledu vidět nemá.
   */
  rodneListy?: Record<string, { id: string; fileName: string }>;
}) {
  const showRodnyList = rodneListy !== undefined;
  return (
    <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Stav</th>
              <th className="text-left px-4 py-3.5">Herec</th>
              <th className="text-right px-4 py-3.5 whitespace-nowrap">Normostrany</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum dokončení</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum vydání</th>
              {showRodnyList && <th className="text-left px-4 py-3.5 whitespace-nowrap">Rodný list</th>}
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={showRodnyList ? 7 : 6} className="px-4 py-8 text-center text-muted text-sm font-body">
                  {emptyText}
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-line hover:bg-[#FAF8FF]">
                <td className="px-4 py-4 font-heading font-semibold text-sm text-ink">{p.name}</td>
                <td className="px-4 py-4">
                  <StatusPill finished={p.finished} statusName={p.statusName} />
                </td>
                <td className="px-4 py-4 text-sm font-heading">{p.narrator ?? '—'}</td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                  {p.pageCount ?? '—'}
                </td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.endDate)}
                </td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.releaseDate)}
                </td>
                {showRodnyList && (
                  <td className="px-4 py-4 text-sm font-heading whitespace-nowrap">
                    {rodneListy?.[String(p.id)] ? (
                      <a
                        href={`/api/rodny-list/${rodneListy[String(p.id)].id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-purple no-underline"
                      >
                        Rodný list ↗
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Admin varianta prehledu projektu - napric VSEMI firmami najednou (na
// rozdil od ProjectsTable vyse, ktera je scoped na jednu firmu pro klienta).
// Datum odevzdani je jen u mistni objednavky a s projekty v Caflou zatim
// neni spolehlive provazane (viz TODO u createCaflouProject), takze tu
// zamerne neni. Normostrany uz ale tahame primo z Caflou (viz
// custom_column_pocet_normostran v mapCaflouProjects), takze tenhle sloupec
// funguje stejne jako u klientske tabulky vyse.
export function AdminProjectsTable({
  projects,
  emptyText,
}: {
  projects: AdminDisplayProject[];
  emptyText: string;
}) {
  return (
    <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-left px-4 py-3.5">Firma</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Stav</th>
              <th className="text-right px-4 py-3.5 whitespace-nowrap">Normostrany</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum dokončení</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum vydání</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm font-body">
                  {emptyText}
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={`${p.companyName}-${p.id}`} className="border-t border-line hover:bg-[#FAF8FF]">
                <td className="px-4 py-4 font-heading font-semibold text-sm text-ink">{p.name}</td>
                <td className="px-4 py-4 text-sm font-heading text-muted">{p.companyName}</td>
                <td className="px-4 py-4">
                  <StatusPill finished={p.finished} statusName={p.statusName} />
                </td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                  {p.pageCount ?? '—'}
                </td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.endDate)}
                </td>
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.releaseDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Interni prehled projektu (zadani 5. 9. 2026)
// ---------------------------------------------------------------------------
// Na rozdil od AdminProjectsTable vyse ukazuje i nase vlastni atributy k
// projektu (priorita, typ, manazer - viz model ProjectMeta) a nazev projektu
// je proklik na detail, kde se daji tyto udaje editovat. Vidi ho jen interni
// ucty Mediaspace.

export type InternalProjectMeta = {
  priority: ProjectPriority | null;
  projectType: string | null;
  managerName: string | null;
};

export type InternalProject = AdminDisplayProject & {
  meta: InternalProjectMeta | null;
};

// Normostrany se drive ukazovaly jen u firem oznacenych jako "delame pro ne
// audioknihy" (zadani 5. 9. 2026). Kvuli tomu chybely u projektu firem, ktere
// tenhle priznak nemely nebo v portalu jeste nejsou zalozene, i kdyz v Caflou
// normostrany byly (zprava uzivatele 8. 9. 2026). Ted plati jednoduse: co je
// v Caflou, to portal ukaze - u reklamnich klientu tam zadne cislo neni, takze
// sloupec zustane prazdny sam od sebe.

/** Sloupce, podle kterych jde v prehledu radit (zadani 5. 9. 2026). */
export type ProjectSortKey =
  | 'name'
  | 'companyName'
  | 'statusName'
  | 'priority'
  | 'projectType'
  | 'managerName'
  | 'pageCount'
  | 'endDate'
  | 'releaseDate';

export type ProjectSort = { key: ProjectSortKey; dir: 'asc' | 'desc' };

const PRIORITY_RANK: Record<ProjectPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

/** Porovnani dvou projektu podle zvoleneho sloupce. Prazdne hodnoty konci vzdy dole. */
export function compareProjects(a: InternalProject, b: InternalProject, sort: ProjectSort): number {
  const dir = sort.dir === 'asc' ? 1 : -1;

  const numeric = (p: InternalProject): number | null => {
    if (sort.key === 'pageCount') return p.pageCount;
    // "Datum dokonceni" je Konec z Caflou; finished_at je jen zaloha.
    if (sort.key === 'endDate') return p.endDate?.getTime() ?? p.finishedAt?.getTime() ?? null;
    if (sort.key === 'releaseDate') return p.releaseDate?.getTime() ?? null;
    if (sort.key === 'priority') {
      const value = p.priority ?? p.meta?.priority ?? null;
      return value ? PRIORITY_RANK[value] : null;
    }
    return null;
  };

  if (
    sort.key === 'pageCount' ||
    sort.key === 'endDate' ||
    sort.key === 'releaseDate' ||
    sort.key === 'priority'
  ) {
    const av = numeric(a);
    const bv = numeric(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return dir * (av - bv);
  }

  const text = (p: InternalProject): string => {
    switch (sort.key) {
      case 'companyName':
        return p.companyName ?? '';
      case 'statusName':
        return p.statusName ?? '';
      case 'projectType':
        return p.meta?.projectType ?? '';
      case 'managerName':
        return p.meta?.managerName ?? '';
      default:
        return p.name ?? '';
    }
  };

  const av = text(a);
  const bv = text(b);
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return dir * av.localeCompare(bv, 'cs');
}

export function PriorityPill({ priority }: { priority: ProjectPriority | null }) {
  if (!priority) return <span className="text-muted">—</span>;
  return (
    <span
      className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill whitespace-nowrap ${PRIORITY_CLASSES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function SortArrow({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3 h-3 shrink-0 transition-transform ${dir === 'desc' ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

/**
 * Obsah jedné buňky podle sloupce - jediné místo, kde je napsané, co který
 * sloupec ukazuje. Díky tomu se dá tabulka poskládat z nastavení (pořadí,
 * skrytí) místo pevně napsané řady <td>.
 */
function bunkaSloupce(p: InternalProject, key: string) {
  switch (key) {
    case 'name':
      return (
        <Link href={`/projekty/${p.id}`} className="text-ink hover:text-brand-purple no-underline">
          {p.name}
        </Link>
      );
    case 'companyName':
      return p.companyName;
    case 'statusName':
      return <StatusPill finished={p.finished} statusName={p.statusName} />;
    case 'priority':
      // Priorita se cerpa z Caflou (zadani 5. 9. 2026); rucne nastavena
      // hodnota v portalu slouzi uz jen jako zaloha, kdyz ji Caflou nevraci.
      return <PriorityPill priority={p.priority ?? p.meta?.priority ?? null} />;
    case 'projectType':
      return projectTypeLabel(p.meta?.projectType) ?? '—';
    case 'managerName':
      return p.meta?.managerName ?? '—';
    case 'pageCount':
      return p.pageCount ?? '—';
    case 'endDate':
      return formatDate(p.endDate);
    case 'releaseDate':
      return formatDate(p.releaseDate);
    default:
      return null;
  }
}

/** Třída buňky podle sloupce - čísla doprava, data bez zalomení. */
const TRIDA_BUNKY: Record<string, string> = {
  name: 'px-3 py-3.5 font-heading font-semibold text-sm',
  companyName: 'px-3 py-3.5 text-sm font-heading text-muted',
  statusName: 'px-4 py-4',
  priority: 'px-3 py-3.5 text-sm font-heading',
  projectType: 'px-3 py-3.5 text-sm font-heading text-muted',
  managerName: 'px-3 py-3.5 text-sm font-heading text-muted',
  pageCount: 'px-3 py-3.5 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap',
  endDate: 'px-3 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap',
  releaseDate: 'px-3 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap',
};

const ZAROVNANI_VPRAVO = new Set(['pageCount']);

/**
 * Který sloupec se zrovna přetahuje. Obyčejná proměnná schválně: přetahování
 * probíhá vždycky jen jedno a useRef by z tohohle souboru udělal klientský
 * modul - a ten se importuje i ze serverových stránek.
 */
let taheny: number | null = null;

/** Úchyt na přetahování - šest teček, ať je jasné, za co se sloupec bere. */
function Uchyt() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

/**
 * Hlavicka sloupce. Bezne se na ni da kliknout a seradit podle ni; v rezimu
 * uprav (tri tecky ve fialove liste, zadani 8. 9. 2026, rozsireno 9. 9. 2026)
 * se z ni stane pole s nazvem, da se pretahnout jinam a krizkem odebrat -
 * uplne stejne jako odkazy v horni liste portalu.
 */
function SortableHeader({
  sloupec,
  index,
  sort,
  onSort,
  editing,
  onLabelChange,
  onMove,
  onHide,
}: {
  sloupec: ColumnSetting;
  index: number;
  sort: ProjectSort;
  onSort: (key: ProjectSortKey) => void;
  editing?: boolean;
  onLabelChange?: (key: string, label: string) => void;
  onMove?: (from: number, to: number) => void;
  onHide?: (key: string) => void;
}) {
  const vpravo = ZAROVNANI_VPRAVO.has(sloupec.key);
  const active = sort.key === (sloupec.key as ProjectSortKey);

  if (editing) {
    return (
      <th
        className="px-2 py-2.5 whitespace-nowrap"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          const from = taheny;
          taheny = null;
          if (from !== null && from !== index) onMove?.(from, index);
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          {/* Pořadí se mění TAHEM ZA ÚCHYT, ne za křížek - ten jen odebírá
              (zpráva uživatele 9. 9. 2026: "mění se pořadí chycením za
              křížek, je to matoucí"). */}
          <span
            draggable
            onDragStart={() => {
              taheny = index;
            }}
            onDragEnd={() => {
              taheny = null;
            }}
            title="Přetažením změníte pořadí"
            className="cursor-grab active:cursor-grabbing text-white/70 hover:text-white"
          >
            <Uchyt />
          </span>
          <button
            type="button"
            onClick={() => onHide?.(sloupec.key)}
            title={`Odebrat ${sloupec.label}`}
            aria-label={`Odebrat ${sloupec.label}`}
            className="w-4 h-4 shrink-0 rounded-full bg-white/90 text-brand-purpleDeep text-[10px] font-bold leading-none flex items-center justify-center hover:bg-white"
          >
            ×
          </button>
          <input
            value={sloupec.label}
            onChange={(e) => onLabelChange?.(sloupec.key, e.target.value)}
            aria-label={`Název sloupce ${sloupec.label}`}
            className={`w-full min-w-[100px] rounded-lg border border-dashed border-white/60 bg-white/10 px-2 py-1 font-heading text-xs text-white placeholder-white/50 outline-none focus:border-white focus:bg-white/20 ${
              vpravo ? 'text-right' : ''
            }`}
          />
        </span>
      </th>
    );
  }

  return (
    <th className={`px-3 py-3.5 whitespace-nowrap ${vpravo ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sloupec.key as ProjectSortKey)}
        title={`Seřadit podle: ${sloupec.label}`}
        className={`inline-flex items-center gap-1.5 font-heading text-xs transition-opacity hover:opacity-100 ${
          active ? 'opacity-100' : 'opacity-80'
        } ${vpravo ? 'flex-row-reverse' : ''}`}
      >
        {sloupec.label}
        {active && <SortArrow dir={sort.dir} />}
      </button>
    </th>
  );
}

export function InternalProjectsTable({
  projects,
  emptyText,
  sort,
  onSort,
  columns,
  editing,
  canEditColumns,
  onStartEditing,
  editActions,
  onLabelChange,
  onMoveColumn,
  onHideColumn,
}: {
  projects: InternalProject[];
  emptyText: string;
  sort: ProjectSort;
  onSort: (key: ProjectSortKey) => void;
  /** Viditelné sloupce v pořadí - výchozí přepsané tím, co si Žůžo-labůžo nastavilo. */
  columns: ColumnSetting[];
  editing?: boolean;
  /** Upravovat sloupce smí jen Žůžo-labůžo. */
  canEditColumns?: boolean;
  onStartEditing?: () => void;
  /** Tlačítka Hotovo / Zrušit / Obnovit výchozí - vykreslí se ve fialové liště. */
  editActions?: React.ReactNode;
  onLabelChange?: (key: string, label: string) => void;
  onMoveColumn?: (from: number, to: number) => void;
  onHideColumn?: (key: string) => void;
}) {
  const sloupcuCelkem = columns.length + (canEditColumns ? 1 : 0);

  return (
    <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
      {/* Sloupcu je hodne a na uzsim okne se tabulka nevejde. Posouvani do
          stran je proto videt: macOS lista se sama schovava, tak si ji tu
          vykreslujeme natrvalo (zadani 8. 9. 2026: "nesmi se stavat, ze se to
          vpravo usekne"). */}
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              {columns.map((sloupec, index) => (
                <SortableHeader
                  key={sloupec.key}
                  sloupec={sloupec}
                  index={index}
                  sort={sort}
                  onSort={onSort}
                  editing={editing}
                  onLabelChange={onLabelChange}
                  onMove={onMoveColumn}
                  onHide={onHideColumn}
                />
              ))}
              {/* Tri tecky primo ve fialove liste (zadani 9. 9. 2026) - stejne
                  misto jako u horni listy portalu.

                  Sloupec je PRILEPENY k pravemu okraji (sticky right-0). Bez
                  toho se tlacitko schovalo za pravy okraj tabulky: sloupcu je
                  vic, nez se vejde do sirky karty, takze se tabulka posouva do
                  stran a tecky skoncily mimo obraz (zprava uzivatele
                  9. 9. 2026: "zmizela uprava sloupcu u projektu"). Radek tela
                  ma proto vlastni bile pozadi - prilepena bunka si ho dedi,
                  aby pod ni text neprosvital. */}
              {canEditColumns && (
                <th className="sticky right-0 z-20 bg-brand-purple px-2 py-2.5 text-right whitespace-nowrap w-px shadow-[-10px_0_10px_-8px_rgba(32,26,51,0.45)]">
                  {editing ? (
                    editActions
                  ) : (
                    <button
                      type="button"
                      onClick={onStartEditing}
                      title="Upravit sloupce"
                      aria-label="Upravit sloupce"
                      className="w-7 h-7 rounded-full bg-white/15 text-white hover:bg-white/30 inline-flex flex-col items-center justify-center gap-[3px] transition-colors"
                    >
                      <span className="w-[3px] h-[3px] rounded-full bg-current" />
                      <span className="w-[3px] h-[3px] rounded-full bg-current" />
                      <span className="w-[3px] h-[3px] rounded-full bg-current" />
                    </button>
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={sloupcuCelkem} className="px-4 py-8 text-center text-muted text-sm font-body">
                  {emptyText}
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-line bg-white hover:bg-[#FAF8FF]">
                {columns.map((sloupec) => (
                  <td key={sloupec.key} className={TRIDA_BUNKY[sloupec.key] ?? 'px-3 py-3.5 text-sm font-heading'}>
                    {bunkaSloupce(p, sloupec.key)}
                  </td>
                ))}
                {canEditColumns && (
                  <td className="sticky right-0 z-10 bg-inherit shadow-[-10px_0_10px_-8px_rgba(32,26,51,0.12)]" />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
