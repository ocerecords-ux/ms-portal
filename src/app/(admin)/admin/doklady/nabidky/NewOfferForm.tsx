'use client';

import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';

/**
 * Založení nabídky (zadání 10. 9. 2026: „dej pryč ten mezikrok"). Kliknutí
 * vede rovnou do editoru s náhledem; nabídka vzniká až tlačítkem Uložit.
 */
export function NewOfferForm() {
  const router = useRouter();

  useOtevriZeZkratky(() => router.push('/admin/doklady/nabidky/nova'));

  return (
    <span id={KOTVA_NOVE}>
      <AddButton onClick={() => router.push('/admin/doklady/nabidky/nova')}>Nová nabídka</AddButton>
    </span>
  );
}
