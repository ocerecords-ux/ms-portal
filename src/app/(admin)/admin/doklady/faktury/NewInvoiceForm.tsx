'use client';

import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';

/**
 * Založení faktury (zadání 10. 9. 2026: „dej pryč ten mezikrok při
 * vystavování dokladu, rovnou po kliknutí ukaž náhled").
 *
 * Dřív se tady rozbalil krátký formulář na tři pole a teprve po jeho odeslání
 * se faktura založila. Teď kliknutí vede rovnou do editoru, kde je vedle
 * formuláře hotový doklad — a doklad vzniká až tlačítkem Uložit. Odběratele
 * i všechno ostatní se vybírá tam, takže se nic nevyplňuje dvakrát.
 *
 * Fakturu z nabídky vystavíte tlačítkem přímo na nabídce.
 */
export function NewInvoiceForm() {
  const router = useRouter();

  // Prisel sem clovek pres rychlou volbu z leveho panelu? Pak rovnou do
  // editoru - zkratka ma vest do editacniho okna, ne jen na stranku
  // (zadani 9. 9. 2026).
  useOtevriZeZkratky(() => router.push('/admin/doklady/faktury/nova'));

  return (
    <span id={KOTVA_NOVE}>
      <AddButton onClick={() => router.push('/admin/doklady/faktury/nova')}>Nová faktura</AddButton>
    </span>
  );
}
