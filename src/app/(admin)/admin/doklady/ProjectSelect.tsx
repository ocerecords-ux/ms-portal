'use client';

export type ProjectChoice = { id: string; label: string; finished: boolean };

/**
 * Výběr projektu u dokladu (zadani 8. 9. 2026). Jedno místo pro nabídku,
 * fakturu i výdaj, aby se to všude chovalo stejně.
 *
 * Rozpracované projekty jsou v první skupině, dokončené pod nimi — fakturuje
 * se běžně až po dokončení, ale nabízet je promíchané by znamenalo hledat.
 * Když projekt uložený u dokladu není v aktuální nabídce (Caflou nedojelo,
 * projekt zmizel), přidá se do seznamu zvlášť, aby vazba nezmizela.
 */
export function ProjectSelect({
  value,
  onChange,
  projects,
  currentName,
  disabled,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  projects: ProjectChoice[];
  currentName?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const rozpracovane = projects.filter((p) => !p.finished);
  const dokoncene = projects.filter((p) => p.finished);
  const chybi = Boolean(value) && !projects.some((p) => p.id === value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="">— bez projektu —</option>
      {chybi && <option value={value}>{currentName || `Projekt ${value}`}</option>}
      {rozpracovane.length > 0 && (
        <optgroup label="Rozpracované">
          {rozpracovane.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </optgroup>
      )}
      {dokoncene.length > 0 && (
        <optgroup label="Dokončené">
          {dokoncene.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
