import { ZalozkyLista } from '@/components/ZalozkyLista';
import { poradiZalozek } from '@/lib/zalozkyServer';
import { ZALOZKY_PREHLEDU } from './zalozky';

/**
 * Lišta záložek sekce Přehledy (zadání 20. 9. 2026: „z něj pak uděláme
 * záložku, ne toto") - místo rozcestníku s kartami se přepíná nahoře.
 *
 * Od 29. 9. 2026 jen obálka nad společnou lištou, takže i tady si každý
 * srovná pořadí po svém. Seznam záložek zůstává v `zalozky.ts`, protože si
 * na něj sahá i přesměrování z /prehledy.
 */
export async function ZalozkyPrehledu({
  role,
  palubovka = false,
}: {
  role?: string | null;
  /** Vidí uživatel Palubovku? Role na ni nestačí - viz zalozky.ts. */
  palubovka?: boolean;
}) {
  const zalozky = ZALOZKY_PREHLEDU.filter(
    (z) => (!z.role || (role && z.role.includes(role))) && (z.jenSPriznakem !== 'palubovka' || palubovka),
  ).map((z) => ({ klic: z.href, href: z.href, nazev: z.label }));

  return <ZalozkyLista sekce="prehledy" zalozky={zalozky} poradi={await poradiZalozek('prehledy')} />;
}
