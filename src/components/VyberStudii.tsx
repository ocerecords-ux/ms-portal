'use client';

import { Volba } from '@/components/Volba';

/**
 * Výběr studií, do kterých se nabízí termíny (zadání 19. 9. 2026: „asi by to
 * tam chtělo zaškrtávací pole" → „v grafice, jak máme kalendáře nebo
 * licence"). Jednotné zaškrtávátko portálu s barvou studia.
 *
 * Herci se nabídnou volná místa ve VŠECH vybraných studiích. Aspoň jedno
 * musí zůstat - poslední vybrané nejde odškrtnout.
 */
export function VyberStudii({
  studia,
  vybrana,
  onZmena,
  disabled,
}: {
  studia: { id: string; name: string; color?: string | null }[];
  vybrana: string[];
  onZmena: (ids: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 py-0.5">
      {studia.map((s) => {
        const zapnute = vybrana.includes(s.id);
        const posledni = zapnute && vybrana.length === 1;
        return (
          <Volba
            key={s.id}
            vybrano={zapnute}
            barva={s.color || '#7B55FF'}
            disabled={disabled}
            title={posledni ? 'Aspoň jedno studio musí zůstat vybrané' : s.name}
            onZmena={(zapnout) => {
              if (!zapnout) {
                if (posledni) return;
                onZmena(vybrana.filter((x) => x !== s.id));
              } else {
                // Poradi podle seznamu studii - prvni vybrane je hlavni studio.
                onZmena(studia.map((x) => x.id).filter((x) => x === s.id || vybrana.includes(x)));
              }
            }}
          >
            {s.name}
          </Volba>
        );
      })}
    </div>
  );
}
