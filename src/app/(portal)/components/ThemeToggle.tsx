'use client';

import { useEffect, useState } from 'react';
import { KLIC_MOTIVU, type Motiv, systemovyMotiv, ulozMotiv, nactiMotiv } from '@/lib/motiv';

/**
 * Přepínač světlého a tmavého režimu (zadání 9. 9. 2026: "dark mode celého
 * portálu"). Sedí v horní liště vedle zvonku.
 *
 * Chování: napoprvé se portál řídí nastavením systému (macOS/Windows). Jakmile
 * uživatel jednou klikne, platí jeho volba a systém se přestane sledovat.
 * Volba se pamatuje v prohlížeči, tedy na zařízení - na Macu můžeš mít tmavý
 * a na mobilu světlý (rozhodnutí uživatele 9. 9. 2026).
 *
 * Vlastní přepnutí třídy .dark na <html> dělá už skript v layout.tsx, který
 * běží před vykreslením stránky. Tady se jen mění hodnota a ukládá volba.
 */
export function ThemeToggle() {
  // Na serveru žádný motiv neznáme - a kdybychom hádali, blikla by po načtení
  // špatná ikona. Proto se ikona dokreslí až v prohlížeči.
  const [motiv, setMotiv] = useState<Motiv | null>(null);

  useEffect(() => {
    setMotiv(nactiMotiv());
  }, []);

  // Dokud si uživatel nevybral, jedeme podle systému - a reagujeme, když si ho
  // přepne za chodu (macOS to umí sám podle času).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const dotaz = window.matchMedia('(prefers-color-scheme: dark)');
    const zmena = () => {
      if (window.localStorage.getItem(KLIC_MOTIVU)) return;
      const novy = systemovyMotiv();
      setMotiv(novy);
      document.documentElement.classList.toggle('dark', novy === 'tmavy');
    };
    dotaz.addEventListener('change', zmena);
    return () => dotaz.removeEventListener('change', zmena);
  }, []);

  function prepni() {
    const novy: Motiv = motiv === 'tmavy' ? 'svetly' : 'tmavy';
    setMotiv(novy);
    ulozMotiv(novy);
    document.documentElement.classList.toggle('dark', novy === 'tmavy');
  }

  const tmavy = motiv === 'tmavy';
  const popis = tmavy ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim';

  return (
    <button
      type="button"
      onClick={prepni}
      title={popis}
      aria-label={popis}
      aria-pressed={tmavy}
      className="w-9 h-9 rounded-full text-white/85 hover:text-white hover:bg-white/15 inline-flex items-center justify-center transition-colors shrink-0"
    >
      {motiv === null ? (
        // Než se v prohlížeči zjistí motiv, drží se jen místo - žádné blikání.
        <span className="w-5 h-5" />
      ) : tmavy ? (
        <MesicIkona />
      ) : (
        <SlunceIkona />
      )}
    </button>
  );
}

function SlunceIkona() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MesicIkona() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.3 14.2A8.6 8.6 0 0 1 9.8 3.7a8.6 8.6 0 1 0 10.5 10.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
