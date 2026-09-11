import { TRIDA_FAJFKY } from '@/lib/bublinaHerce';

/**
 * Zelená fajfka u dotočeného herce (zadání 11. 9. 2026). Je to samostatná
 * komponenta, protože se ukazuje v přehledu projektů i v jejich detailu a
 * na obou místech má vypadat i znamenat totéž.
 *
 * `kdy` je datum odškrtnutí — jde do bublinkové nápovědy, aby se dalo
 * dohledat, odkdy to platí, aniž by to zabíralo místo v tabulce.
 */
export function FajfkaDotoceno({ kdy }: { kdy?: string | null }) {
  const popis = kdy
    ? `Dotočeno ${new Date(kdy).toLocaleDateString('cs-CZ')}`
    : 'Dotočeno';
  return (
    <span className={TRIDA_FAJFKY} title={popis} aria-label={popis}>
      ✓
    </span>
  );
}
