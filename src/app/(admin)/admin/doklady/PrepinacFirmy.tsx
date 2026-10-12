'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { KLIC_FIRMY, PLATNOST_FIRMY_S, VSECHNY_FIRMY } from '@/lib/naseFirmy';

/**
 * PŘEPÍNAČ NAŠÍ FIRMY V DOKLADECH (zadání 12. 10. 2026: „určitě potřebuji
 * oddělit účetnictví, ale zároveň chci ponechat řízení projektů a kalendáře
 * v jednom portálu").
 *
 * Přepne se firma a celá sekce Doklady - nabídky, faktury, výdaje, smlouvy
 * i banka - ukazuje jen ji. Výběr drží cookie (rok platnosti, stejně jako
 * jazyk), takže stránka přijde ze serveru rovnou odfiltrovaná a po
 * přihlášení se nemusí vybírat znovu.
 *
 * S JEDINOU FIRMOU SE NEKRESLÍ. Dokud má člověk k dispozici jednu naši firmu,
 * nemá co přepínat a lišta by byla jen o řádek delší.
 */
export function PrepinacFirmy({
  firmy,
  vybrana,
}: {
  firmy: { id: string; name: string }[];
  /** Prázdné = všechny firmy. */
  vybrana: string;
}) {
  const t = usePreklad();
  const router = useRouter();
  const [prepinam, setPrepinam] = useState<string | null>(null);

  // Až se server vrátí s novým výběrem, tlačítko přestane čekat.
  useEffect(() => setPrepinam(null), [vybrana]);

  if (firmy.length <= 1) return null;

  function prepni(nova: string) {
    if (nova === vybrana || prepinam !== null) return;
    setPrepinam(nova);
    document.cookie = `${KLIC_FIRMY}=${nova}; path=/; max-age=${PLATNOST_FIRMY_S}; samesite=lax`;
    router.refresh();
  }

  const volby = [{ id: VSECHNY_FIRMY, name: t('naseFirmy.vsechny') }, ...firmy];

  return (
    <div
      className="flex items-center gap-1 rounded-pill border border-line bg-surface p-0.5"
      role="group"
      aria-label={t('naseFirmy.prepinac')}
      title={t('naseFirmy.prepinacPopis')}
    >
      {volby.map((v) => {
        const vybrany = v.id === vybrana;
        return (
          <button
            key={v.id || 'vse'}
            type="button"
            onClick={() => prepni(v.id)}
            aria-pressed={vybrany}
            disabled={prepinam !== null}
            className={`rounded-pill px-2.5 py-1 text-xs font-heading whitespace-nowrap transition-colors cursor-pointer disabled:cursor-wait ${
              vybrany
                ? 'bg-brand-purple text-white'
                : 'text-muted hover:text-ink hover:bg-field'
            }`}
          >
            {v.name}
          </button>
        );
      })}
    </div>
  );
}
