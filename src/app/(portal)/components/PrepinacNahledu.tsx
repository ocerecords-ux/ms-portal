'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NAHLED_COOKIE, NAHLED_POHLEDY, pohledNahledu, type NahledVolba } from '@/lib/nahledRole';

/**
 * PRUH NÁHLEDOVÉHO ÚČTU (zadání 18. 9. 2026: „profil pro uživatele, který
 * nemůže nic měnit, jen si může vyzkoušet celý portál z různých rolí.
 * Herec, Tým, Klient").
 *
 * Vidí ho JEN náhledový účet - ostatním se nevykreslí vůbec (viz layout).
 * Je schválně nahoře a barevně jinak než zbytek portálu: kdo si portál
 * prohlíží, má mít pořád na očích, že je to prohlídka a že se nic neuloží.
 *
 * Přepnutí je jen cookie a načtení stránky znovu - žádné ukládání, jinak by
 * si přepínač sám narazil na zámek zápisu. Server si z cookie vybere jen
 * jednu ze tří povolených hodnot a uplatní ji jedině u účtu s příznakem
 * `jenNahled` (viz lib/auth.ts).
 *
 * Po přepnutí se jde na Projekty: každá role vidí jiné stránky a člověk,
 * který si přepne z týmu na klienta nad Výkazy, by jinak skončil na
 * obrazovce, kam ho ta nová role nepustí.
 */
export function PrepinacNahledu({ volba }: { volba: NahledVolba }) {
  const router = useRouter();
  const [prepinam, setPrepinam] = useState<NahledVolba | null>(null);

  // Az server vrati novy pohled, tlacitko prestane cekat.
  useEffect(() => setPrepinam(null), [volba]);

  function prepni(nova: NahledVolba) {
    if (nova === volba || prepinam) return;
    setPrepinam(nova);
    // Rok platnosti - at si clovek nemusi pohled vybirat po kazdem prihlaseni.
    document.cookie = `${NAHLED_COOKIE}=${nova}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push('/projekty');
    router.refresh();
  }

  const aktualni = pohledNahledu(volba);

  return (
    <div className="px-4 sm:px-6 py-2 bg-warnTint border-b border-line flex items-center gap-x-3 gap-y-1.5 flex-wrap">
      <span className="font-heading font-bold text-[11px] uppercase tracking-wider text-status-progress shrink-0">
        Náhled
      </span>
      <span className="text-xs font-body text-muted min-w-0">
        Prohlížíte portál jako <strong className="text-ink font-semibold">{aktualni.popisek}</strong>{' '}
        <span className="hidden sm:inline">— {aktualni.vysvetleni}.</span> Nic se z tohohle účtu
        neuloží.
      </span>
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {NAHLED_POHLEDY.map((p) => {
          const vybrany = p.volba === volba;
          return (
            <button
              key={p.volba}
              type="button"
              onClick={() => prepni(p.volba)}
              disabled={Boolean(prepinam)}
              title={p.vysvetleni}
              aria-pressed={vybrany}
              className={`font-heading font-semibold text-xs rounded-lg px-3 py-1 transition-colors disabled:opacity-60 ${
                vybrany
                  ? 'bg-brand-purple text-white'
                  : 'bg-surface border border-line text-ink hover:border-brand-purple'
              }`}
            >
              {prepinam === p.volba ? 'Přepínám…' : p.popisek}
            </button>
          );
        })}
      </div>
    </div>
  );
}
