'use client';

import { useEffect, useState } from 'react';
import { MOBIL_DOTAZ, type Zarizeni } from '@/lib/zarizeni';

/** Aktuální zařízení podle šířky okna. Na serveru a před načtením: počítač. */
export function useZarizeni(): Zarizeni {
  const [zarizeni, setZarizeni] = useState<Zarizeni>('POCITAC');
  useEffect(() => {
    const dotaz = window.matchMedia(MOBIL_DOTAZ);
    const uprav = () => setZarizeni(dotaz.matches ? 'MOBIL' : 'POCITAC');
    uprav();
    dotaz.addEventListener('change', uprav);
    return () => dotaz.removeEventListener('change', uprav);
  }, []);
  return zarizeni;
}
