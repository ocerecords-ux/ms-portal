"use client";

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { KLIC_JAZYKA, PLATNOST_JAZYKA_S, prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * Jazyk pro komponenty v prohlížeči (zadání 13. 9. 2026).
 *
 * Hodnota přichází ze serveru z cookie, takže se tu nic nedopočítává - jen se
 * rozdá dál. Přepnutí zapíše cookie a nechá stránku překreslit; serverové
 * komponenty se tím přeloží samy.
 */
const Kontext = createContext<Jazyk>('cs');

export function JazykProvider({ jazyk, children }: { jazyk: Jazyk; children: React.ReactNode }) {
  return <Kontext.Provider value={jazyk}>{children}</Kontext.Provider>;
}

export function useJazyk(): Jazyk {
  return useContext(Kontext);
}

/** t('klic') pro texty v komponentě. */
export function usePreklad(): (klic: string) => string {
  const jazyk = useJazyk();
  return useCallback((klic: string) => prelozit(jazyk, klic), [jazyk]);
}

/** Přepnutí jazyka - zapíše cookie a překreslí stránku. */
export function usePrepnoutJazyk(): (novy: Jazyk) => void {
  const router = useRouter();
  return useMemo(
    () => (novy: Jazyk) => {
      document.cookie = `${KLIC_JAZYKA}=${novy}; path=/; max-age=${PLATNOST_JAZYKA_S}; samesite=lax`;
      router.refresh();
    },
    [router],
  );
}
