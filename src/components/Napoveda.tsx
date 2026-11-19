'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * NÁPOVĚDA POD OTAZNÍKEM (zadání 19. 11. 2026: „všechny nápovědní texty
 * dejme pod otazník, ať je portál čistý").
 *
 * Vysvětlující věty u políček a tlačítek jsou k nezaplacení, když je člověk
 * potřebuje - a zabírají půl obrazovky, když je zná nazpaměť. Tenhle otazníček
 * je schová: sedí hned vedle popisku, klepnutím se text rozbalí a dalším
 * klepnutím (nebo Escapem, nebo kliknutím mimo) zase zmizí.
 *
 * NENÍ TO `NapovedaOtaznik`. Ten otevírá celý návod z Nápovědy a tahá si ho
 * ze serveru; tenhle drží jednu dvě věty, které už v kódu jsou, a nic
 * nenačítá.
 *
 * Bublina se kreslí absolutně nad obsahem, takže se pod ní nic neposouvá -
 * rozbalená nápověda nesmí rozhodit formulář, do kterého člověk zrovna píše.
 */
export function Napoveda({
  text,
  /** Vlevo u pravého okraje obrazovky, ať bublina neuteče ven. */
  vlevo = false,
}: {
  /** Obyčejná věta, nebo kousek JSX - některé nápovědy mají tučné slovo. */
  text: ReactNode;
  vlevo?: boolean;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!otevreno) return;
    const mimo = (e: MouseEvent) => {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOtevreno(false);
      }
    };
    document.addEventListener('mousedown', mimo);
    document.addEventListener('keydown', klavesa);
    return () => {
      document.removeEventListener('mousedown', mimo);
      document.removeEventListener('keydown', klavesa);
    };
  }, [otevreno]);

  if (!text) return null;

  return (
    <span ref={obal} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => {
          // Otazník často sedí uvnitř <label>. Bez tohohle by klepnutí na něj
          // rovnou skočilo do políčka (a u data otevřelo kalendář).
          e.preventDefault();
          e.stopPropagation();
          setOtevreno((o) => !o);
        }}
        aria-expanded={otevreno}
        // `title` schválně taky: kdo jen přejede myší, nemusí klikat vůbec.
        // U nápovědy složené z JSX se bublina otevře klepnutím, bublina stačí.
        title={typeof text === 'string' ? text : undefined}
        aria-label={typeof text === 'string' ? text : 'Nápověda'}
        className={`inline-grid place-items-center w-4 h-4 rounded-full border text-[10px] font-heading font-bold leading-none cursor-pointer bg-transparent transition-colors ${
          otevreno
            ? 'border-brand-purple text-brand-purple'
            : 'border-line text-muted hover:border-brand-purple hover:text-brand-purple'
        }`}
      >
        ?
      </button>
      {otevreno && (
        <span
          role="note"
          className={`absolute top-full mt-1.5 z-30 w-[280px] max-w-[70vw] rounded-lg border border-line bg-surface shadow-lg px-3 py-2 text-xs font-body text-ink leading-relaxed ${
            vlevo ? 'right-0' : 'left-0'
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
