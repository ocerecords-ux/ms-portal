import Link from 'next/link';
import type { ProjectPriority } from '@prisma/client';
import type { AdminDisplayProject, DisplayProject } from '@/lib/caflou';
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
 * Hlavicka sloupce, na kterou jde kliknout a seradit podle ni. V rezimu uprav
 * (tri tecky nad tabulkou, zadani 8. 9. 2026) se z ni stane pole, ve kterem
 * jde nazev sloupce prepsat.
 */
function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
  editing,
  onLabelChange,
}: {
  label: string;
  sortKey: ProjectSortKey;
  sort: ProjectSort;
  onSort: (key: ProjectSortKey) => void;
  align?: 'left' | 'right';
  editing?: boolean;
  onLabelChange?: (key: ProjectSortKey, label: string) => void;
}) {
  const active = sort.key === sortKey;

  if (editing) {
    return (
      <th className="px-2 py-2.5 whitespace-nowrap">
        <input
          value={label}
          onChange={(e) => onLabelChange?.(sortKey, e.target.value)}
          aria-label={`Název sloupce ${label}`}
          className={`w-full min-w-[90px] rounded-lg border border-dashed border-white/60 bg-white/10 px-2 py-1 font-heading text-xs text-white placeholder-white/50 outline-none focus:border-white focus:bg-white/20 ${
            align === 'right' ? 'text-right' : ''
          }`}
        />
      </th>
    );
  }

  return (
    <th className={`px-3 py-3.5 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Seřadit podle: ${label}`}
        className={`inline-flex items-center gap-1.5 font-heading text-xs transition-opacity hover:opacity-100 ${
          active ? 'opacity-100' : 'opacity-80'
        } ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
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
  labels,
  editing,
  onLabelChange,
}: {
  projects: InternalProject[];
  emptyText: string;
  sort: ProjectSort;
  onSort: (key: ProjectSortKey) => void;
  /** Názvy sloupců - výchozí přepsané tím, co si Žůžo-labůžo nastavilo. */
  labels: Record<string, string>;
  editing?: boolean;
  onLabelChange?: (key: ProjectSortKey, label: string) => void;
}) {
  const head = (key: ProjectSortKey, align?: 'left' | 'right') => (
    <SortableHeader
      label={labels[key] ?? key}
      sortKey={key}
      sort={sort}
      onSort={onSort}
      align={align}
      editing={editing}
      onLabelChange={onLabelChange}
    />
  );

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
              {head('name')}
              {head('companyName')}
              {head('statusName')}
              {head('priority')}
              {head('projectType')}
              {head('managerName')}
              {head('pageCount', 'right')}
              {head('endDate')}
              {head('releaseDate')}
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted text-sm font-body">
                  {emptyText}
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-line hover:bg-[#FAF8FF]">
                <td className="px-3 py-3.5 font-heading font-semibold text-sm">
                  <Link href={`/projekty/${p.id}`} className="text-ink hover:text-brand-purple no-underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-3.5 text-sm font-heading text-muted">{p.companyName}</td>
                <td className="px-4 py-4">
                  <StatusPill finished={p.finished} statusName={p.statusName} />
                </td>
                <td className="px-3 py-3.5 text-sm font-heading">
                  {/* Priorita se cerpa z Caflou (zadani 5. 9. 2026); rucne
                      nastavena hodnota v portalu slouzi uz jen jako zaloha,
                      kdyz ji Caflou nevraci. */}
                  <PriorityPill priority={p.priority ?? p.meta?.priority ?? null} />
                </td>
                <td className="px-3 py-3.5 text-sm font-heading text-muted">
                  {projectTypeLabel(p.meta?.projectType) ?? '—'}
                </td>
                <td className="px-3 py-3.5 text-sm font-heading text-muted">
                  {p.meta?.managerName ?? '—'}
                </td>
                <td className="px-3 py-3.5 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                  {p.pageCount ?? '—'}
                </td>
                <td className="px-3 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.endDate)}
                </td>
                <td className="px-3 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
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
