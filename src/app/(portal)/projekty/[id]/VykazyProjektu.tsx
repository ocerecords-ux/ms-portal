'use client';

import { useMemo, useState } from 'react';
import type { WorkType } from '@prisma/client';
import { WORK_TYPE_LABELS, durationMinutes, entryAmount, formatDuration, formatTime, toHours } from '@/lib/timesheets';

/**
 * VÝKAZY K PROJEKTU pod rozpočtem (zadání 13. 9. 2026: „u těch rozpočtů by
 * bylo super vidět všechny výkazy. A aby se pak daly filtrovat na Natáčení
 * a střih").
 *
 * Do teď se z výkazů ukazoval jediný údaj — „Vykázáno 17 h" v čerpání. Když
 * ale rozpočet nesedí, je první otázka, kdo a kdy si co zapsal, a na to se
 * muselo chodit do Výkazů a filtrovat podle projektu.
 *
 * FILTR PŘEPOČÍTÁVÁ I SOUČTY, ne jen řádky. Otázka za tím není „které řádky
 * jsou střih", ale „kolik nás stál střih" — kdyby souhrn zůstal za celý
 * projekt, filtr by odpovídal na půl otázky.
 *
 * Nabízejí se jen druhy práce, které u projektu opravdu jsou. Prázdný filtr,
 * po kterém zůstane prázdná tabulka, je jen past na klikání. „Ostatní" se tu
 * neobjeví nikdy: u toho druhu se projekt nevybírá (viz requiresProject).
 */

export type VykazRadek = {
  id: string;
  /** ISO řetězec - server komponenta nesmí posílat Date. */
  den: string;
  odMinut: number;
  doMinut: number;
  sazba: number;
  druh: WorkType;
  poznamka: string | null;
  kdo: string;
};

const czk = (v: number) => `${v.toLocaleString('cs-CZ')} Kč`;

export function VykazyProjektu({ vykazy }: { vykazy: VykazRadek[] }) {
  const [filtr, setFiltr] = useState<WorkType | 'VSE'>('VSE');

  /** Druhy práce, které u projektu skutečně jsou - v pořadí natáčení, střih. */
  const druhy = useMemo(() => {
    const jsou = new Set(vykazy.map((v) => v.druh));
    return (['RECORDING', 'EDITING', 'OTHER'] as WorkType[]).filter((d) => jsou.has(d));
  }, [vykazy]);

  const videt = useMemo(
    () => (filtr === 'VSE' ? vykazy : vykazy.filter((v) => v.druh === filtr)),
    [vykazy, filtr],
  );

  const souhrn = useMemo(() => {
    const minut = videt.reduce((s, v) => s + durationMinutes(v.odMinut, v.doMinut), 0);
    const castka = videt.reduce((s, v) => s + entryAmount(v.odMinut, v.doMinut, v.sazba), 0);
    return { minut, castka };
  }, [videt]);

  if (vykazy.length === 0) {
    return (
      <div className="bg-surface rounded-card border border-line shadow-sm p-6">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0 mb-2">
          Výkazy
        </h2>
        <p className="text-sm font-body text-muted m-0">
          K tomuhle projektu zatím nikdo nevykázal žádnou práci.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Výkazy</h2>
        {/* Souhrn se ridi filtrem - viz poznamka na zacatku souboru. */}
        <span className="text-sm font-heading text-ink tabular-nums">
          {formatDuration(souhrn.minut)} · {czk(souhrn.castka)}
          <span className="text-muted font-body text-xs">
            {' '}
            ({videt.length} {videt.length === 1 ? 'záznam' : videt.length < 5 ? 'záznamy' : 'záznamů'})
          </span>
        </span>
      </div>

      {/* Filtr se ukazuje, jen kdyz je z ceho vybirat - u projektu s jedinym
          druhem prace by to bylo tlacitko, ktere nic nedela. */}
      {druhy.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Prepinac aktivni={filtr === 'VSE'} onClick={() => setFiltr('VSE')}>
            Vše
          </Prepinac>
          {druhy.map((d) => (
            <Prepinac key={d} aktivni={filtr === d} onClick={() => setFiltr(d)}>
              {WORK_TYPE_LABELS[d]}
            </Prepinac>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-field">
              <th className={TRIDA_ZAHLAVI}>Datum</th>
              <th className={TRIDA_ZAHLAVI}>Druh</th>
              <th className={TRIDA_ZAHLAVI}>Zvukař</th>
              <th className={TRIDA_ZAHLAVI}>Od–do</th>
              <th className={`${TRIDA_ZAHLAVI} text-right`}>Hodin</th>
              <th className={`${TRIDA_ZAHLAVI} text-right`}>Částka</th>
            </tr>
          </thead>
          <tbody>
            {videt.map((v) => {
              const minut = durationMinutes(v.odMinut, v.doMinut);
              return (
                <tr key={v.id} className="border-t border-line">
                  <td className="px-3 py-2 text-[13px] font-heading text-ink tabular-nums whitespace-nowrap">
                    {new Date(v.den).toLocaleDateString('cs-CZ')}
                  </td>
                  <td className="px-3 py-2 text-[13px] font-heading text-muted whitespace-nowrap">
                    {WORK_TYPE_LABELS[v.druh]}
                  </td>
                  {/* Poznamka z vykazu jde do bublinky, ne do sloupce - bez ni
                      se tabulka cte, s ni by se rozpadla na ruzne vysoke radky. */}
                  <td
                    className="px-3 py-2 text-[13px] font-heading text-muted"
                    title={v.poznamka ?? undefined}
                  >
                    {v.kdo}
                    {v.poznamka && <span className="text-muted"> ·</span>}
                  </td>
                  <td className="px-3 py-2 text-[13px] font-heading text-muted tabular-nums whitespace-nowrap">
                    {formatTime(v.odMinut)}–{formatTime(v.doMinut)}
                  </td>
                  <td className="px-3 py-2 text-[13px] font-heading text-muted tabular-nums text-right whitespace-nowrap">
                    {toHours(minut).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-[13px] font-heading text-ink tabular-nums text-right whitespace-nowrap">
                    {czk(entryAmount(v.odMinut, v.doMinut, v.sazba))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TRIDA_ZAHLAVI =
  'text-left px-3 py-2 text-[11px] font-heading text-muted uppercase tracking-wide font-semibold whitespace-nowrap';

function Prepinac({
  aktivni,
  onClick,
  children,
}: {
  aktivni: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktivni}
      className={`rounded-pill px-3 py-1 text-xs font-heading font-semibold border transition-colors ${
        aktivni
          ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
          : 'border-line text-muted hover:text-ink hover:border-brand-purple/40'
      }`}
    >
      {children}
    </button>
  );
}
