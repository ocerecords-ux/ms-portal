'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { FIRMA_COOKIE } from '@/lib/firmaKlienta';
import { usePreklad } from './JazykProvider';

/**
 * PŘEPÍNAČ FIRMY (zadání 15. 10. 2026: „máme jednoho klienta, který by
 * potřeboval přepínat mezi firmami Audiolibrix a Čti mi!. Přihlašoval by se
 * jen tímto mailem").
 *
 * Vidí ho JEN účet, který má u sebe nějakou firmu navíc - ostatním se
 * nevykreslí vůbec (viz layout). Přepnutí je jen cookie a načtení stránky
 * znovu; firmu z ní vybere server a ověří ji proti seznamu u účtu
 * (lib/auth.ts, lib/firmaKlienta.ts).
 *
 * Po přepnutí se jde na Projekty. Člověk stojící nad detailem zakázky jedné
 * firmy by se po přepnutí díval na cizí stránku, kam ho nová firma nepustí -
 * tak ať radši skončí tam, kde je vidět, co se pro vybranou firmu dělá.
 */
export function PrepinacFirem({
  firmy,
  aktivni,
}: {
  firmy: { id: string; name: string }[];
  aktivni: string | null;
}) {
  const t = usePreklad();
  const router = useRouter();
  const [prepinam, setPrepinam] = useState<string | null>(null);

  // Az server vrati novou firmu, tlacitko prestane cekat.
  useEffect(() => setPrepinam(null), [aktivni]);

  function prepni(id: string) {
    if (id === aktivni || prepinam) return;
    setPrepinam(id);
    // Rok platnosti - at si clovek firmu nevybira po kazdem prihlaseni.
    document.cookie = `${FIRMA_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push('/projekty');
    router.refresh();
  }

  return (
    <div className="px-4 sm:px-6 py-2 bg-surfaceSoft border-b border-line flex items-center gap-x-3 gap-y-1.5 flex-wrap">
      <span className="font-heading font-bold text-[11px] uppercase tracking-wider text-muted shrink-0">
        {t('prepinacFirem.stitek')}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        {firmy.map((f) => {
          const vybrana = f.id === aktivni;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => prepni(f.id)}
              disabled={Boolean(prepinam)}
              title={t('prepinacFirem.prepnoutNa', { firma: f.name })}
              aria-pressed={vybrana}
              className={`font-heading font-semibold text-xs rounded-lg px-3 py-1 transition-colors disabled:opacity-60 ${
                vybrana
                  ? 'bg-brand-purple text-white'
                  : 'bg-surface border border-line text-ink hover:border-brand-purple'
              }`}
            >
              {prepinam === f.id ? t('prepinacFirem.prepinam') : f.name}
            </button>
          );
        })}
      </div>
      <span className="text-xs font-body text-muted min-w-0 hidden sm:block">
        {t('prepinacFirem.popis')}
      </span>
    </div>
  );
}
