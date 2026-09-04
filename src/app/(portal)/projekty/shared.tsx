import type { DisplayProject } from '@/lib/caflou';

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

export function ProjectsTable({ projects, emptyText }: { projects: DisplayProject[]; emptyText: string }) {
  return (
    <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Stav</th>
              <th className="text-left px-4 py-3.5">Herec</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum dokončení</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap">Datum vydání</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
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
                <td className="px-4 py-4 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                  {p.finished ? formatDate(p.finishedAt) : '—'}
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
