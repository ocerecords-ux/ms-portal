'use client';

/**
 * Zaškrtávací výběr studií, do kterých se nabízí termíny (zadání 19. 9. 2026:
 * „už by se měla objevit ta studia obě brněnská, když plánujeme" → „asi by
 * to tam chtělo zaškrtávací pole").
 *
 * Herci se nabídnou volná místa ve VŠECH zaškrtnutých studiích. Aspoň jedno
 * musí zůstat - poslední zaškrtnuté nejde odškrtnout.
 */
export function VyberStudii({
  studia,
  vybrana,
  onZmena,
  disabled,
}: {
  studia: { id: string; name: string }[];
  vybrana: string[];
  onZmena: (ids: string[]) => void;
  disabled?: boolean;
}) {
  function prepni(id: string) {
    if (vybrana.includes(id)) {
      if (vybrana.length === 1) return;
      onZmena(vybrana.filter((x) => x !== id));
    } else {
      // Poradi podle seznamu studii - prvni zaskrtnute je hlavni studio nabidky.
      onZmena(studia.map((s) => s.id).filter((x) => x === id || vybrana.includes(x)));
    }
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 py-1">
      {studia.map((s) => {
        const zaskrtnute = vybrana.includes(s.id);
        return (
          <label
            key={s.id}
            className={`inline-flex items-center gap-2 text-sm font-heading cursor-pointer select-none ${
              zaskrtnute ? 'text-ink' : 'text-muted'
            }`}
          >
            <input
              type="checkbox"
              checked={zaskrtnute}
              disabled={disabled || (zaskrtnute && vybrana.length === 1)}
              onChange={() => prepni(s.id)}
              className="w-4 h-4 accent-[var(--brand-purple,#7B55FF)]"
            />
            {s.name}
          </label>
        );
      })}
    </div>
  );
}
