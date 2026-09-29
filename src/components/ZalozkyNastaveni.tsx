import { ZalozkyLista } from '@/components/ZalozkyLista';
import { poradiZalozek } from '@/lib/zalozkyServer';

/**
 * ZÁLOŽKY V NASTAVENÍ SEKCE (zadání 28. 9. 2026: „tohle dej do záložek -
 * karet").
 *
 * Od 29. 9. 2026 je to jen obálka nad společnou lištou - vypadá i přeskládává
 * se stejně jako záložky v Dokladech nebo Přehledech. Klíč záložky se bere
 * z adresy, takže se nemusí vypisovat zvlášť.
 */
export async function ZalozkyNastaveni({
  sekce,
  zalozky,
}: {
  /** Pod kterým klíčem se ukládá vlastní pořadí - např. „nastaveni-doklady". */
  sekce: string;
  zalozky: { href: string; nazev: string }[];
}) {
  return (
    <ZalozkyLista
      sekce={sekce}
      zalozky={zalozky.map((z) => ({ ...z, klic: z.href }))}
      poradi={await poradiZalozek(sekce)}
    />
  );
}
