import { ZalozkyLista } from '@/components/ZalozkyLista';
import { poradiZalozek } from '@/lib/zalozkyServer';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';
import { ZALOZKY_DOKLADU } from './zalozkyDokladu';

/**
 * Záložky sekce Doklady.
 *
 * Od 29. 9. 2026 je vykreslování i přeskládávání společné pro celý portál -
 * viz components/ZalozkyLista.tsx. Tady zůstává jen seznam záložek a to, kdo
 * kterou vidí.
 */

/**
 * `banka` = vidí tenhle člověk sekci Banka? Párování plateb a napojení účtu
 * vidí jen ten, kdo to má dovolené u účtu (zadání 17. 9. 2026: „nastavení
 * a párování banky bych měl vidět jen já a Bára Šiblová").
 *
 * `pokladna` = totéž pro hotovostní pokladnu (23. 10. 2026). Je to vlastní
 * právo, ne tentýž příznak: hotovost a bankovní účet se můžou rozejít.
 */
export async function DokladyTabs({
  banka = false,
  pokladna = false,
}: {
  banka?: boolean;
  pokladna?: boolean;
}) {
  const jazyk = nactiJazyk();
  const zalozky = ZALOZKY_DOKLADU.filter(
    (z) => (z.klic !== 'banka' || banka) && (z.klic !== 'pokladna' || pokladna),
  ).map((z) => ({
    klic: z.klic,
    href: z.href,
    nazev: prelozit(jazyk, z.preklad),
  }));

  return <ZalozkyLista sekce="doklady" zalozky={zalozky} poradi={await poradiZalozek('doklady')} />;
}
