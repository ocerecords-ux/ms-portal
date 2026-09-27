import { type ProgresNataceni } from '@/lib/progresNataceni';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * Kolik stran zbývá - česky ve třech tvarech, anglicky v jednom. Celá věta je
 * pokaždé jeden klíč, neskládá se z kousků (pravidlo 7).
 */
function zbyvaText(jazyk: Jazyk, pocet: number): string {
  const klic =
    pocet === 1
      ? 'progres.zbyvaJedna'
      : pocet >= 2 && pocet <= 4
        ? 'progres.zbyvaMalo'
        : 'progres.zbyvaVic';
  return prelozitS(jazyk, klic, { pocet });
}

/**
 * Vodorovný válec „Progres natáčení" (zadání 19. 9. 2026). Stejný u herce,
 * klienta i v detailu projektu. Bez stavu a efektů - vykreslí ho server
 * i klientská komponenta.
 */
export function ValecProgresu({
  progres,
  prazdne,
  kompaktni = false,
  velky = false,
  // Válec kreslí server i klientská komponenta - jazyk chodí propem (pravidlo 8).
  jazyk = 'cs',
}: {
  progres: ProgresNataceni;
  /** Co ukázat, když se progres spočítat nedá. */
  prazdne?: string;
  jazyk?: Jazyk;
  /** Do úzké buňky tabulky - bez druhého řádku s popisem, popis v bublině. */
  kompaktni?: boolean;
  /** Karta v detailu projektu - vyšší válec a velká procenta. */
  velky?: boolean;
}) {
  if (!progres)
    return (
      <span className="text-xs font-body text-muted">{prazdne ?? prelozit(jazyk, 'progres.prazdne')}</span>
    );
  const popis = `${progres.popis} · ${progres.procenta} %`;
  // Kolik zbyva dotocit (19. 9. 2026) - u dotoceneho a souhrnu vic hercu ne.
  const zbyva = !progres.dotoceno && progres.zbyva != null ? zbyvaText(jazyk, progres.zbyva) : null;
  return (
    <div className="flex flex-col gap-1 min-w-[90px] w-full" title={zbyva ? `${popis} · ${zbyva}` : popis}>
      <div className={`flex items-center ${kompaktni ? 'gap-2' : 'gap-4'}`}>
        <div
          className={`${velky ? 'h-4' : 'h-3'} flex-1 rounded-pill bg-field border border-line overflow-hidden`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progres.procenta}
          aria-label={prelozit(jazyk, 'progres.popisek')}
        >
          <div
            className="h-full rounded-pill bg-brand-green transition-[width] duration-500"
            style={{ width: `${progres.procenta}%` }}
          />
        </div>
        {kompaktni ? (
          <span className="text-xs font-heading font-semibold text-brand-greenDeep dark:text-brand-green tabular-nums w-9 text-right">
            {progres.procenta} %
          </span>
        ) : (
          // Procenta velka a zelena (zadani 19. 9. 2026: „ty procenta by tam
          // mohly svitit vetsim a zelene").
          <span className={`font-display ${velky ? 'text-3xl sm:text-4xl' : 'text-xl'} leading-none text-brand-greenDeep dark:text-brand-green tabular-nums whitespace-nowrap`}>
            {progres.procenta} %
          </span>
        )}
      </div>
      {!kompaktni && (
        <span className="text-xs font-body text-muted tabular-nums">
          {progres.popis}
          {zbyva && (
            <>
              {' · '}
              <span className="font-heading font-semibold text-ink">{zbyva}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
