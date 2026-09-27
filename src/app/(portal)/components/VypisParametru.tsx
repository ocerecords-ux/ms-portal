'use client';

import type { SekceTech } from '@/lib/technickeParametry';
import { prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * VÝPIS TECHNICKÝCH PARAMETRŮ (zadání 27. 9. 2026: „ať je to přehledné").
 *
 * Jedna podoba pro kartu projektu i pro okno v chatu - kdyby se to kreslilo
 * dvakrát, začaly by se ty dvě obrazovky časem rozcházet. Nadpis sekce a pod
 * ním parametry po řádcích; žádné odstavce, tohle se čte očima při práci.
 *
 * V kartě projektu jdou sekce VEDLE SEBE (`sloupce`): Albatros jich má pět
 * a pod sebou by z nich byla obrazovka textu, kterou nikdo nepřečte. V úzkém
 * okně chatu zůstávají pod sebou.
 *
 * JAZYK CHODÍ PROPEM, ne hookem: kartu v detailu projektu vykresluje serverová
 * stránka a `usePreklad()` by na serveru spadl (pravidlo 8
 * v docs/preklad-portalu.md). Kdo jazyk nemá, nechá výchozí češtinu.
 */
export function VypisParametru({
  sekce,
  husty = false,
  sloupce = false,
  jazyk = 'cs',
}: {
  sekce: SekceTech[];
  husty?: boolean;
  sloupce?: boolean;
  jazyk?: Jazyk;
}) {
  if (sekce.length === 0) {
    return <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'parametry.nicTuNeni')}</p>;
  }
  return (
    <div
      className={
        sloupce
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 items-start'
          : `flex flex-col ${husty ? 'gap-3' : 'gap-4'}`
      }
    >
      {sekce.map((s, i) => (
        <div key={`${s.nadpis}-${i}`} className="flex flex-col gap-1 min-w-0">
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
