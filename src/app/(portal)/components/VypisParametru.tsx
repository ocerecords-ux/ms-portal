'use client';

import type { SekceTech } from '@/lib/technickeParametry';

/**
 * VÝPIS TECHNICKÝCH PARAMETRŮ (zadání 27. 9. 2026: „ať je to přehledné").
 *
 * Jedna podoba pro kartu projektu i pro okno v chatu - kdyby se to kreslilo
 * dvakrát, začaly by se ty dvě obrazovky časem rozcházet. Nadpis sekce a pod
 * ním parametry po řádcích; žádné odstavce, tohle se čte očima při práci.
 */
export function VypisParametru({ sekce, husty = false }: { sekce: SekceTech[]; husty?: boolean }) {
  if (sekce.length === 0) {
    return <p className="text-sm font-body text-muted m-0">Pro tenhle projekt tu zatím nic není.</p>;
  }
  return (
    <div className={`flex flex-col ${husty ? 'gap-3' : 'gap-4'}`}>
      {sekce.map((s, i) => (
        <div key={`${s.nadpis}-${i}`} className="flex flex-col gap-1">
          <span className="font-heading font-semibold text-[11px] uppercase tracking-wide text-muted">
            {s.nadpis}
          </span>
          <ul className="list-none p-0 m-0 flex flex-col gap-1">
            {s.radky.map((r, j) => (
              <li
                key={j}
                className={`font-body text-ink leading-snug pl-3 border-l-2 border-brand-purple/30 ${
                  husty ? 'text-[13px]' : 'text-sm'
                }`}
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
