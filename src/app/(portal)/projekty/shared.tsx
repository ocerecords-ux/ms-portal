import Link from 'next/link';
import type { ProjectPriority } from '@prisma/client';
import type { AdminDisplayProject, DisplayProject } from '@/lib/projektyTypy';
import type { ColumnSetting } from '@/lib/columnLabels';
import { PRIORITY_CLASSES, PRIORITY_LABELS, PRIORITY_OPTIONS, projectTypeLabel } from '@/lib/projectTypes';
import { initials } from '@/lib/chat';
import { barvaStavu } from '@/lib/stavyProjektu';
import { IkonaTypu } from '@/lib/ikonyTypu';
import { HerciBunka } from './HerciBunka';
import { StavProjektuSelect } from './StavProjektuSelect';
import { OdkazTlacitko } from '../components/OdkazTlacitko';
import { UpravitelneDatum, UpravitelnyVyber } from './UpravitelnaBunka';

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
  // Barva podle konkretniho stavu (lib/stavyProjektu.ts), ne jen podle toho,
  // jestli je projekt hotovy - stavu je osm a dva odstiny by je slily.
  //
  // OREZAVA SE SAM V SOBE (oprava 12. 9. 2026: „na strance klienta jsou nejake
  // useknute veci v grafice a tri tecky random"). Kdyz orezavala bunka, visely
  // tri tecky ZA bublinou jako samostatny znak a vypadaly jako omyl. Takhle se
  // orizne text uvnitr a cely stav zustane v bublinkove napovede.
  return (
    <span
      title={displayStatusName(statusName)}
      className={`inline-flex items-center gap-1.5 text-xs font-heading font-semibold px-3 py-1 rounded-pill whitespace-nowrap max-w-full truncate ${barvaStavu(
        statusName,
        finished,
      )}`}
    >
      {displayStatusName(statusName)}
    </span>
  );
}

export function ProjectsTable({
  projects,
  emptyText,
  rodneListy,
  preposlech,
}: {
  projects: DisplayProject[];
  emptyText: string;
  /**
   * Stav přeposlechu podle ID projektu (zadání 12. 9. 2026). Když se prop
   * nepředá, sloupce se nevykreslí — u dokončených projektů nemá smysl
   * ukazovat, kolik zbývá doposlechnout.
   */
  preposlech?: Record<string, { stop: number; poslechnuto: number; hotovo: boolean }>;
  /**
   * Rodné listy reklamních spotů podle ID projektu v Caflou (zadání 9. 9. 2026).
   * Když se prop nepředá, sloupec se vůbec nevykreslí - u audioknih nemá RL
   * smysl a klient, který reklamy nedělá, ho v přehledu vidět nemá.
   */
  rodneListy?: Record<string, { id: string; fileName: string }>;
}) {
  const showRodnyList = rodneListy !== undefined;
  const showPreposlech = preposlech !== undefined;
  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      {/* Stejne jako u interniho prehledu: procentni sirky, jeden radek na
          bunku, zadne posouvani do stran (zadani 12. 9. 2026). */}
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full min-w-[620px] table-fixed border-collapse">
          <colgroup>
            {sirkySloupcu([
              'name',
              'statusName',
              'narrator',
              'pageCountSirsi',
              'endDate',
              'releaseDate',
              ...(showPreposlech ? ['kPreposlechu', 'preposlechnuto'] : []),
              ...(showRodnyList ? ['rodnyList'] : []),
            ]).map((sirka, i) => (
              <col key={i} style={{ width: sirka }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-left px-4 py-3.5">Stav</th>
              <th className="text-left px-4 py-3.5">Herec</th>
              {/* „NS" misto „Normostrany" - usetrena sirka se hodi nazvum
                  a hercum (zadani 12. 9. 2026). */}
              <th className="text-right px-4 py-3.5 whitespace-nowrap" title="Normostrany">NS</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Dokončení</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Vydání</th>
              {/* Dva sloupce k přeposlechu (zadání 12. 9. 2026): jestli už je
                  co poslouchat, a jak daleko poslech došel. */}
              {showPreposlech && <th className="text-left px-4 py-3.5 whitespace-nowrap">K přeposlechu</th>}
              {showPreposlech && <th className="text-left px-4 py-3.5 whitespace-nowrap">Přeposlechnuto</th>}
              {showRodnyList && <th className="text-left px-4 py-3.5">Rodný list</th>}
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={6 + (showPreposlech ? 2 : 0) + (showRodnyList ? 1 : 0)}
                  className="px-4 py-8 text-center text-muted text-sm font-body"
                >
                  {emptyText}
                </td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className={TRIDA_RADKU}>
                {/* NAZEV KNIHY MUSI BYT CELY (zadani 12. 9. 2026: „nazvy knih
                    musi byt cele. Kdyz to nevejde, dej to na dalsi radek").
                    Radek se o to zvysi - 52 px je u tabulky minimum, ne strop. */}
                <td className="px-4 py-2 font-heading font-semibold text-sm text-ink align-middle">
                  <span className="block leading-tight break-words">{p.name}</span>
                </td>
                <td className="px-4 py-0 overflow-hidden">
                  <StatusPill finished={p.finished} statusName={p.statusName} />
                </td>
                {/* Herec je bublina jako v internim prehledu (zadani
                    12. 9. 2026: „pojdme stejny princip s bublinama udelat
                    i v tom klientskem prehledu"). Bublinu ma jen herec
                    s uctem v portalu; jmeno z Caflou zustava sedym textem,
                    protoze na nem nic nestoji. Zelena linka „dotoceno" sem
                    nepatri - to je nase vyroba, klientovi staci stav. */}
                <td className="px-4 py-0 text-sm font-heading align-middle">
                  {p.herci && p.herci.length > 0 ? (
                    // Herci pod sebou, stejne jako v internim prehledu (zadani
                    // 12. 9. 2026). Dotoceno se klientovi neukazuje - to je
                    // nase vyroba, jemu staci stav.
                    <HerciBunka herci={p.herci.map((h) => ({ jmeno: h.jmeno, dotoceno: false }))} />
                  ) : (
                    <span className="text-muted" title={p.narrator ?? undefined}>
                      {p.narrator ?? '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-0 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                  {p.pageCount ?? '—'}
                </td>
                <td className="px-4 py-0 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.endDate)}
                </td>
                <td className="px-4 py-0 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.releaseDate)}
                </td>
                {showPreposlech && <BunkaKPreposlechu stav={preposlech?.[String(p.id)]} />}
                {showPreposlech && <BunkaPreposlechnuto stav={preposlech?.[String(p.id)]} />}
                {showRodnyList && (
                  <td className="px-4 py-0 text-sm font-heading whitespace-nowrap">
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
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full min-w-[620px] table-fixed border-collapse">
          <colgroup>
            {sirkySloupcu([
              'name',
              'companyName',
              'statusName',
              'pageCountSirsi',
              'endDate',
              'releaseDate',
            ]).map(
              (sirka, i) => (
                <col key={i} style={{ width: sirka }} />
              ),
            )}
          </colgroup>
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-left px-4 py-3.5">Firma</th>
              <th className="text-left px-4 py-3.5">Stav</th>
              <th className="text-right px-4 py-3.5">Normostrany</th>
              <th className="text-left px-4 py-3.5">Dokončení</th>
              <th className="text-left px-4 py-3.5">Vydání</th>
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
              <tr key={`${p.companyName}-${p.id}`} className={TRIDA_RADKU}>
                <td
                  className="px-4 py-0 font-heading font-semibold text-sm text-ink truncate"
                  title={p.name}
                >
                  {p.name}
                </td>
                <td className="px-4 py-0 text-sm font-heading text-muted truncate" title={p.companyName}>
                  {p.companyName}
                </td>
                <td className="px-4 py-0 overflow-hidden">
                  <StatusPill finished={p.finished} statusName={p.statusName} />
                </td>
                <td className="px-4 py-0 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap">
                  {p.pageCount ?? '—'}
                </td>
                <td className="px-4 py-0 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {formatDate(p.endDate)}
                </td>
                <td className="px-4 py-0 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
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
  /** Fotka manazera do bunky vedle jmena (zadani 9. 9. 2026). */
  managerPhotoUrl: string | null;
  /** Slozka projektu na Google Disku - v prehledu jako tlacitko (10. 9. 2026). */
  driveUrl: string | null;
  /** Kvuli uprave manazera primo v prehledu. */
  managerUserId: string | null;
  /** Ikona typu projektu - sviti pred nazvem (zadani 10. 9. 2026). */
  ikonaTypu: string | null;
  /** Jmena hercu projektu, hlavni prvni (zadani 10. 9. 2026 - muze jich byt vic). */
  /**
   * Herci projektu v poradi. `dotoceno` = zelena fajfka u jmena (zadani
   * 11. 9. 2026: "fajfku prosim v prehledu i v detailu").
   */
  herci: { jmeno: string; dotoceno: boolean }[];
  /** Jména herců jedním textem - jen pro hledání, nikde se nevypisuje. */
  herciJmenaText: string;
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
  | 'narrator'
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
      case 'narrator':
        return p.narrator ?? '';
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
      title={PRIORITY_LABELS[priority]}
      className={`inline-flex items-center max-w-full truncate text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${PRIORITY_CLASSES[priority]}`}
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
/** Datum pro <input type="date"> - YYYY-MM-DD, nebo prazdno. */
function proInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

function bunkaSloupce(
  p: InternalProject,
  key: string,
  muzeMenit: boolean,
  manazeri: { id: string; label: string }[],
) {
  const id = String(p.id);
  switch (key) {
    case 'name':
      // Nazev je proklik na detail projektu - nic vic.
      //
      // Kratce (10. 9. 2026) sel upravovat i tady v prehledu, ale byla to
      // past: clovek klikne na nazev knihy, protoze chce do projektu, a misto
      // toho si otevre pole a prepisuje nazev. Uprava nazvu zustava v detailu
      // projektu, kde je k tomu formular a je jasne, co se deje.
      //
      // JEDEN RADEK (zadani 12. 9. 2026: „hrozne nam tam litaji radky, prosim
      // srovnat"). Nazev je nejsirsi sloupec a bere si vsechno, co ostatni
      // nepotrebuji, takze se skoro vzdycky vejde cely; delsi se orezne a
      // uplny je v bublinkove napovede. Zalomeny nazev delal ze dvou sousednich
      // radku dvojnasobne vysoke a seznam se pak nedal projizdet ocima.
      return (
        <span className="flex items-center gap-2.5 min-w-0 max-w-full" title={p.name}>
          {/* Projekt bez ikony si misto ni nechava prazdno (zadani 12. 9.
              2026: „projekty, ktere nemaji ikony, by se mely spise zarovnat
              nazvem, ne podle te ikony") - nazvy tak stoji v jedne linii. */}
          <IkonaTypu klic={p.meta?.ikonaTypu} typProjektu={p.meta?.projectType} mezeraKdyzNeni />
          <Link
            href={`/projekty/${p.id}`}
            className="text-ink hover:text-brand-purple no-underline truncate"
          >
            {p.name}
          </Link>
        </span>
      );
    case 'companyName':
      return p.companyName;
    case 'statusName':
      // Stav jde prehodit rovnou v seznamu (zadani 10. 9. 2026) - kdo na to
      // nema pravo, vidi jen odznak.
      return muzeMenit ? (
        <StavProjektuSelect caflouProjectId={String(p.id)} stav={p.statusName} dokonceny={p.finished} />
      ) : (
        <StatusPill finished={p.finished} statusName={p.statusName} />
      );
    case 'priority': {
      const hodnota = p.priority ?? p.meta?.priority ?? null;
      const odznak = <PriorityPill priority={hodnota} />;
      return muzeMenit ? (
        <UpravitelnyVyber
          caflouProjectId={id}
          pole="priority"
          hodnota={hodnota ?? ''}
          moznosti={PRIORITY_OPTIONS.map((o) => ({ hodnota: o, popisek: PRIORITY_LABELS[o] }))}
          deti={odznak}
        />
      ) : (
        odznak
      );
    }
    case 'projectType':
      return projectTypeLabel(p.meta?.projectType) ?? '—';
    case 'managerName': {
      // Fotka vedle jmena, stejne jako v horni liste (zadani 9. 9. 2026).
      const jmeno = p.meta?.managerName;
      const obsah = jmeno ? (
        <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
          <AvatarManazera jmeno={jmeno} photoUrl={p.meta?.managerPhotoUrl ?? null} />
          <span className="truncate">{jmeno}</span>
        </span>
      ) : (
        <span className="text-muted">—</span>
      );
      return muzeMenit ? (
        <UpravitelnyVyber
          caflouProjectId={id}
          pole="managerUserId"
          hodnota={p.meta?.managerUserId ?? ''}
          moznosti={manazeri.map((m) => ({ hodnota: m.id, popisek: m.label }))}
          prazdnyPopisek="— nevybráno —"
          deti={obsah}
        />
      ) : (
        obsah
      );
    }
    case 'narrator': {
      // Herec je bublina, ale v prehledu se NEEDITUJE (zadani 10. 9. 2026:
      // "ten krizek v prehledu je nebezpecny, herce bych editoval jen
      // v detailu"). Odebrat herce jednim kliknutim pri projizdeni seznamu
      // je moc snadne a nic se u toho neptá.
      //
      // Bublina ma jen ten, kdo ma prirazeny ucet. Jmeno z Caflou je porad
      // jen text, na kterem nic nestoji - proto zustava sede a bez bubliny.
      // Hercu muze byt vic (zadani 10. 9. 2026) - jdou pod sebe, kazdy ve sve
      // bubline. Kdyz zadny prirazeny ucet neni, zbyva jmeno z Caflou: jen
      // sedy text, na kterem nic nestoji.
      if (p.meta?.herci?.length) {
        // HERCI POD SEBOU, RADEK SE ZVYSI (zadani 12. 9. 2026). Drive tu byla
        // jen prvni bublina a za ni „+2" - jmeno se do ni neveslo a urizlo se
        // uprostred. Viz HerciBunka.tsx.
        return <HerciBunka herci={p.meta.herci} />;
      }
      if (!p.narrator) return '—';
      return (
        <span
          className="text-muted whitespace-nowrap"
          title="Herec zatím nemá přiřazený účet — doplní se v detailu projektu"
        >
          {p.narrator}
        </span>
      );
    }
    case 'pageCount':
      return p.pageCount ?? '—';
    case 'endDate':
      return muzeMenit ? (
        <UpravitelneDatum
          caflouProjectId={id}
          pole="endDate"
          hodnota={proInput(p.endDate)}
          popisek={formatDate(p.endDate)}
        />
      ) : (
        formatDate(p.endDate)
      );
    case 'releaseDate':
      return muzeMenit ? (
        <UpravitelneDatum
          caflouProjectId={id}
          pole="releaseDate"
          hodnota={proInput(p.releaseDate)}
          popisek={formatDate(p.releaseDate)}
        />
      ) : (
        formatDate(p.releaseDate)
      );
    case 'driveUrl':
      // Jen tlacitko, adresa se neukazuje - v tabulce by rozhodila sirku
      // sloupcu (zadani 10. 9. 2026).
      return p.meta?.driveUrl ? (
        <OdkazTlacitko url={p.meta.driveUrl} popisek="Složka" varianta="ikona" />
      ) : (
        <span className="text-muted">—</span>
      );
    default:
      return null;
  }
}

/** Třída buňky podle sloupce - čísla doprava, data bez zalomení. */
/**
 * ŠÍŘKY SLOUPCŮ JSOU POMĚRY, NE PIXELY (zadání 12. 9. 2026: „ať se jednou pro
 * vždy neobjeví na tom přehledu projektů posuvníky, to je špatně, vymysli,
 * jak to tam vejde").
 *
 * Tabulka běží v režimu `table-fixed` a každý sloupec dostane procento
 * z toho, co je zrovna k dispozici. Součet je vždycky 100 %, takže tabulka
 * nemůže přetéct — ať je okno jakkoliv široké a ať si kdo chce zapne jakékoliv
 * sloupce. Dřív měly sloupce pevné pixely a stačilo pár zapnutých navíc, aby
 * se seznam začal posouvat do stran.
 *
 * Čísla jsou VÁHY, ne procenta: přepočítají se podle toho, které sloupce jsou
 * zrovna vidět. Název dostal nejvíc — ten se má vejít celý.
 */
const VAHA_SLOUPCE: Record<string, number> = {
  name: 27,
  // „Dokonceno - ke schvaleni" je nejdelsi stav a ma se vejit cely
  // (oprava 12. 9. 2026).
  statusName: 21,
  narrator: 16,
  managerName: 11,
  companyName: 10,
  endDate: 10,
  releaseDate: 10,
  priority: 8,
  projectType: 8,
  pageCount: 6,
  driveUrl: 4,
  /**
   * Klientsky prehled ma sloupec navic, ktery nese TLACITKO, ne text - kdyz
   * dostal sirku jako ikonka Disku, tlacitko z bunky vylezlo a rozsirilo
   * stranku (zadani 12. 9. 2026).
   */
  rodnyList: 10,
  /**
   * Fajfka nebo krizek. Sirka je podle popisku v hlavicce, ktery ma zustat
   * na jednom radku (zadani 12. 9. 2026).
   */
  kPreposlechu: 11,
  /** „3 z 24" nebo „Dokonceno". */
  preposlechnuto: 11,
  /**
   * V klientskem prehledu se sloupec od 12. 9. 2026 jmenuje „NS" - dlouhe
   * „Normostrany" si bralo sirku, kterou potrebuji nazvy knih a herci.
   */
  pageCountSirsi: 7,
};

export function sirkySloupcu(klice: string[]): string[] {
  const vahy = klice.map((k) => VAHA_SLOUPCE[k] ?? 12);
  const soucet = vahy.reduce((a, b) => a + b, 0) || 1;
  return vahy.map((v) => `${((v / soucet) * 100).toFixed(3)}%`);
}

/**
 * KAŽDÁ BUŇKA JE NA JEDEN ŘÁDEK (zadání 12. 9. 2026: „hrozně nám tam lítají
 * řádky, prosím srovnat"). Co se nevejde, se ořízne třemi tečkami a celé je
 * v bublinkové nápovědě. Řádky tak mají všechny stejnou výšku a seznam se dá
 * projíždět očima.
 */
const TRIDA_BUNKY: Record<string, string> = {
  name: 'px-3 py-0 font-heading font-semibold text-sm truncate',
  companyName: 'px-3 py-0 text-sm font-heading text-muted truncate',
  statusName: 'px-3 py-0 truncate',
  priority: 'px-2 py-0 text-sm font-heading truncate',
  projectType: 'px-3 py-0 text-sm font-heading text-muted truncate',
  managerName: 'px-3 py-0 text-sm font-heading text-muted truncate',
  // Herci nejsou na jeden radek - jdou pod sebe a radek se o to zvysi
  // (zadani 12. 9. 2026: „hlavne nesmi byt nic useknute").
  narrator: 'px-3 py-0 text-sm font-heading text-muted align-middle',
  pageCount: 'px-2 py-0 text-sm font-heading text-muted tabular-nums text-right whitespace-nowrap',
  endDate: 'px-2 py-0 text-sm font-heading text-muted tabular-nums whitespace-nowrap truncate',
  releaseDate: 'px-2 py-0 text-sm font-heading text-muted tabular-nums whitespace-nowrap truncate',
  driveUrl: 'px-2 py-0 whitespace-nowrap',
};

/**
 * Jedna výška pro všechny řádky - kvůli tomu to celé je. U tabulky se `height`
 * chová jako MINIMUM, takže řádek s několika herci se o ně zvýší (zadání
 * 12. 9. 2026: „roztáhne se celý řádek projektu vertikálně") a zbytek seznamu
 * zůstává srovnaný na 52 px.
 */
const TRIDA_RADKU = 'h-[52px] border-t border-line hover:bg-surfaceSoft';

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
  // Sloupec, podle ktereho je tabulka serazena, se zvyraznuje podle toho, na
  // cem lezi (zadani 9. 9. 2026):
  //   - tmavy pruh (Doklady, Ceniky, Uzivatele) -> svetle fialova, at to
  //     tolik nerve,
  //   - fialovy pruh (tahle tabulka) -> ZELENA. Fialova na fialove proste
  //     neni videt, zkouseli jsme to.
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
        {/* Cely obdelnicek se chyti a presune (zprava uzivatele 9. 9. 2026:
            "normalne bych ten obdelnicek chytil a presunul"). Uchyt uz neni
            porad na ocich - zelena ikonka se ukaze az po najeti mysi, takze
            v klidu je hlavicka cista.

            Krizek se z tazeni vyjima (draggable={false} a zastaveni
            mousedown), jinak by se pri chyceni za nej zase presouvalo -
            presne to uzivateli vadilo drive. */}
        <span
          draggable
          onDragStart={() => {
            taheny = index;
          }}
          onDragEnd={() => {
            taheny = null;
          }}
          title="Přetažením změníte pořadí"
          className="group inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/60 bg-white/10 px-1.5 py-1 cursor-grab active:cursor-grabbing hover:bg-white/20 hover:border-white transition-colors"
        >
          <span
            aria-hidden="true"
            className="text-brand-green opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <Uchyt />
          </span>
          <input
            value={sloupec.label}
            onChange={(e) => onLabelChange?.(sloupec.key, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            draggable={false}
            aria-label={`Název sloupce ${sloupec.label}`}
            className={`w-full min-w-[100px] bg-transparent px-1 py-0.5 font-heading text-xs text-white placeholder-white/50 outline-none ${
              vpravo ? 'text-right' : ''
            }`}
          />
          <button
            type="button"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            onClick={() => onHide?.(sloupec.key)}
            title={`Odebrat ${sloupec.label}`}
            aria-label={`Odebrat ${sloupec.label}`}
            className="w-4 h-4 shrink-0 rounded-full bg-white/90 text-brand-purpleDeep text-[10px] font-bold leading-none flex items-center justify-center hover:bg-white"
          >
            ×
          </button>
        </span>
      </th>
    );
  }

  // Nazev sloupce se radeji ZALOMI na dva radky, nez aby z „Manazer projektu"
  // zbylo „Manazer proje..." (zadani 12. 9. 2026). Hlavicka je jedna, takze
  // o radek vyssi lista nikomu nevadi - vyska radku v tele zustava stejna.
  return (
    <th className={`px-3 py-3 align-bottom ${vpravo ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sloupec.key as ProjectSortKey)}
        title={`Seřadit podle: ${sloupec.label}`}
        className={`inline-flex items-end gap-1.5 max-w-full text-left font-heading text-xs leading-tight transition-colors hover:text-brand-green ${
          active ? 'text-brand-green' : 'text-white/85'
        } ${vpravo ? 'flex-row-reverse text-right' : ''}`}
      >
        <span className="min-w-0">{sloupec.label}</span>
        {active && <SortArrow dir={sort.dir} />}
      </button>
    </th>
  );
}

/**
 * Fotka manazera v tabulce projektu (zadani 9. 9. 2026: "ta fotka by se mela
 * objevit i u jmena manazera v projektech").
 *
 * Kdyz fotka chybi, ukazi se iniciály - stejne jako v horni liste a v chatu.
 * Chybu nacteni obrazku tady neresime jako v chatu: tenhle soubor je
 * i serverovy, takze v nem nesmi byt stav (useState). Rozbity obrazek by
 * prohlizec ukazal jako prazdne kolecko, coz je prijatelne.
 */
/**
 * „K PŘEPOSLECHU" (zadání 12. 9. 2026: „bude tam buď zelená fajfka nebo
 * červený křížek, podle toho, jestli se už přidal první záznam
 * v AudioTaggeru").
 *
 * Fajfka znamená, že v AudioTaggeru jsou nahrávky — tedy je co poslouchat.
 * Počet stop se bere z posledního otevření AudioTaggeru, ne z Disku: padesát
 * projektů by jinak znamenalo padesát dotazů do Google API při každém
 * otevření přehledu.
 */
function BunkaKPreposlechu({ stav }: { stav?: { stop: number } }) {
  const pripraveno = (stav?.stop ?? 0) > 0;
  return (
    <td className="px-4 py-0 whitespace-nowrap">
      <span
        title={pripraveno ? `Nahrávky jsou nachystané (${stav?.stop})` : 'Nahrávky zatím nejsou'}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
          pripraveno ? 'bg-brand-green/15 text-status-done' : 'bg-dangerTint text-danger'
        }`}
      >
        {pripraveno ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M5 13l4.5 4.5L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        )}
        <span className="sr-only">{pripraveno ? 'Připraveno k přeposlechu' : 'Zatím není co poslouchat'}</span>
      </span>
    </td>
  );
}

/**
 * „PŘEPOSLECHNUTO" (zadání 12. 9. 2026: „tam bude počet tracků a kolik je
 * z nich přeposlechnuto, třeba 3 z 24. A když se přeposlech dokončí,
 * rozsvítí se tam Dokončeno").
 *
 * Stopa se počítá, až když ji někdo doposlechl do konce — viz
 * /api/projekty/[id]/preposlech/stopa.
 */
function BunkaPreposlechnuto({ stav }: { stav?: { stop: number; poslechnuto: number; hotovo: boolean } }) {
  if (stav?.hotovo) {
    return (
      <td className="px-4 py-0 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-heading font-semibold px-3 py-1 rounded-pill bg-brand-green text-onAccent">
          Dokončeno
        </span>
      </td>
    );
  }
  if (!stav || stav.stop === 0) {
    return <td className="px-4 py-0 text-sm font-heading text-muted whitespace-nowrap">—</td>;
  }
  return (
    <td className="px-4 py-0 text-sm font-heading text-muted whitespace-nowrap">
      <span className="tabular-nums">
        <span className={stav.poslechnuto > 0 ? 'text-ink font-semibold' : ''}>{stav.poslechnuto}</span> z{' '}
        {stav.stop}
      </span>
    </td>
  );
}

function AvatarManazera({ jmeno, photoUrl }: { jmeno: string; photoUrl: string | null }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt=""
        className="w-6 h-6 rounded-full object-cover shrink-0 border border-line bg-field"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="w-6 h-6 rounded-full shrink-0 bg-brand-purple/15 text-brand-purpleDark text-[10px] font-heading font-bold flex items-center justify-center"
    >
      {initials(jmeno)}
    </span>
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
  onLabelChange,
  onMoveColumn,
  onHideColumn,
  canEditStatus = false,
  manazeri = [],
}: {
  projects: InternalProject[];
  emptyText: string;
  sort: ProjectSort;
  onSort: (key: ProjectSortKey) => void;
  /** Viditelné sloupce v pořadí - výchozí přepsané tím, co si Žůžo-labůžo nastavilo. */
  columns: ColumnSetting[];
  editing?: boolean;
  /** Přehazovat stav smí Produkce a Žůžo-labůžo (zadání 10. 9. 2026). */
  canEditStatus?: boolean;
  /** Manazeri do rozbalovaciho seznamu primo v prehledu (zadani 10. 9. 2026). */
  manazeri?: { id: string; label: string }[];
  /** Upravovat sloupce smí jen Žůžo-labůžo. */
  canEditColumns?: boolean;
  onStartEditing?: () => void;
  onLabelChange?: (key: string, label: string) => void;
  onMoveColumn?: (from: number, to: number) => void;
  onHideColumn?: (key: string) => void;
}) {
  const sloupcuCelkem = columns.length + (canEditColumns ? 1 : 0);

  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      {/* ŽÁDNÉ POSUVNÍKY DO STRAN (zadání 12. 9. 2026). Tabulka je
          `table-fixed` a sloupce mají procenta, takže se vejde vždycky - ať je
          okno jakkoliv široké a ať je zapnutých sloupců kolik chce. Co se do
          sloupce nevejde, se ořízne třemi tečkami a celé je v nápovědě.
          Posouvání zbývá jen pro opravdu úzká okna, kde by se dál zmenšovat
          nedalo. */}
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full min-w-[620px] table-fixed border-collapse">
          <colgroup>
            {sirkySloupcu(columns.map((c) => c.key)).map((sirka, i) => (
              <col key={columns[i].key} style={{ width: sirka }} />
            ))}
            {canEditColumns && <col style={{ width: '44px' }} />}
          </colgroup>
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

                  Tlacitko se drive schovavalo za pravy okraj tabulky. Chvili
                  bylo reseni prilepit celou bunku k okraji (sticky), ale to
                  delalo pruh pres cele telo tabulky a lezlo to pres zaobleny
                  roh karty (zprava uzivatele 9. 9. 2026: "zasahuje do spodni
                  casti a tabulky jdou za roh"). Sirka obsahu se proto misto
                  toho zvetsila v layoutu tak, aby se tabulka vesla cela. */}
              {canEditColumns && (
                <th className="px-2 py-2.5 text-right whitespace-nowrap w-px">
                  {editing ? null : (
                    <button
                      type="button"
                      onClick={onStartEditing}
                      title="Upravit sloupce"
                      aria-label="Upravit sloupce"
                      className="w-7 h-7 rounded-full text-brand-green hover:bg-white/15 inline-flex flex-col items-center justify-center gap-[3px] transition-colors"
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
              <tr key={p.id} className={TRIDA_RADKU}>
                {columns.map((sloupec) => (
                  <td
                    key={sloupec.key}
                    className={TRIDA_BUNKY[sloupec.key] ?? 'px-3 py-0 text-sm font-heading truncate'}
                  >
                    {bunkaSloupce(p, sloupec.key, canEditStatus, manazeri)}
                  </td>
                ))}
                {canEditColumns && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
