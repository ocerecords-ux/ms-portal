import type { ProgresNataceni } from '@/lib/progresNataceni';

/**
 * Vodorovný válec „Progres natáčení" (zadání 19. 9. 2026). Stejný u herce,
 * klienta i v detailu projektu. Bez stavu a efektů - vykreslí ho server
 * i klientská komponenta.
 */
export function ValecProgresu({
  progres,
  prazdne = 'text zatím nemáme',
  kompaktni = false,
}: {
  progres: ProgresNataceni;
  /** Co ukázat, když se progres spočítat nedá. */
  prazdne?: string;
  /** Do úzké buňky tabulky - bez druhého řádku s popisem, popis v bublině. */
  kompaktni?: boolean;
}) {
  if (!progres) return <span className="text-xs font-body text-muted">{prazdne}</span>;
  const popis = `${progres.popis} · ${progres.procenta} %`;
  return (
    <div className="flex flex-col gap-1 min-w-[90px] w-full" title={popis}>
      <div className="flex items-center gap-2">
        <div
          className="h-3 flex-1 rounded-pill bg-field border border-line overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progres.procenta}
          aria-label="Progres natáčení"
        >
          <div
            className="h-full rounded-pill bg-brand-green transition-[width] duration-500"
            style={{ width: `${progres.procenta}%` }}
          />
        </div>
        {kompaktni && (
          <span className="text-xs font-heading font-semibold text-ink tabular-nums w-9 text-right">
            {progres.procenta} %
          </span>
        )}
      </div>
      {!kompaktni && <span className="text-xs font-body text-muted tabular-nums">{popis}</span>}
    </div>
  );
}
