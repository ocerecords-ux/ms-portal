'use client';

import { useEffect } from 'react';

/**
 * Rychlé volby z levého panelu (zadání 9. 9. 2026: "po stisknutí zkratky
 * potřebuju, ať se rovnou proklikám do nové nabídky - editačního okna, jinak
 * zkratka postrádá smysl").
 *
 * Zakládací formuláře nejsou samostatné stránky - sedí složené pod tabulkou
 * na příslušném seznamu. Zkratka proto míří na tu stránku a přidá kotvu
 * `#nove`; formulář si jí při otevření stránky všimne, rozbalí se a odroluje
 * se k sobě.
 *
 * Řeší se to kotvou, ne parametrem v adrese: kotva se nikam neposílá na
 * server, takže stránka může zůstat serverová a nic se kvůli tomu nemusí
 * načítat znovu.
 */

export const KOTVA_NOVE = 'nove';

/** Adresa zkratky na danou stránku - `/admin/doklady/nabidky#nove`. */
export function odkazNaNove(cesta: string): string {
  return `${cesta}#${KOTVA_NOVE}`;
}

/**
 * Otevře zakládací formulář, když se na stránku přišlo přes zkratku.
 *
 * `otevri` se volá jen jednou, hned po otevření stránky. Kotva se pak
 * z adresy odstraní, aby se formulář znovu neotevřel při každém obnovení -
 * to by člověka, který si stránku jen obnovuje, otravovalo.
 */
export function useOtevriZeZkratky(otevri: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== `#${KOTVA_NOVE}`) return;

    otevri();
    history.replaceState(null, '', window.location.pathname + window.location.search);

    // Odrolovat až po vykreslení rozbaleného formuláře, jinak by se skákalo
    // na místo, kde ještě nic není.
    const id = window.setTimeout(() => {
      document.getElementById(KOTVA_NOVE)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(id);
    // Schválně jen při otevření stránky - `otevri` se mezi vykresleními mění,
    // ale spouštět tohle víckrát nechceme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
