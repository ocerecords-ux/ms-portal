'use client';

import { ChecklistIcon, ClockIcon } from './TaskDock';
import { usePoctyDoku, usePravyDok } from './pravyDok';

/**
 * Jedno poutko na pravé hraně, kterým se otevírá panel Úkolů a MS chatu
 * (zadání 10. 9. 2026: „staly tam dvě záložky, stačí jedna").
 *
 * VYKRESLUJE HO LAYOUT, ne některý z panelů — oprava 11. 9. 2026. Předtím ho
 * měl na starosti MS chat, jenže ten se v nainstalované aplikaci schovává
 * (chat tam má vlastní aplikaci), a s ním zmizelo i poutko, takže se nedalo
 * dostat ani k úkolům. Samostatná komponenta na cizích pravidlech nezávisí.
 */
export function PoutkoDoku() {
  const [dok, otevri] = usePravyDok();
  const pocty = usePoctyDoku();

  // Otevreny panel ma vlastni hlavicku se zalozkami - poutko by pres nej leželo.
  if (dok !== null) return null;

  const neprectene = pocty.chat ?? 0;
  const ukoly = pocty.ukoly ?? 0;
  const poTerminu = pocty.poTerminu ?? 0;

  return (
    <button
      type="button"
      onClick={() => otevri('chat')}
      title="Zobrazit MS chat a úkoly"
      aria-label="Zobrazit MS chat a úkoly"
      className="fixed right-0 top-28 z-40 flex flex-col items-center gap-2.5 bg-brand-purple hover:bg-brand-purpleDeep rounded-l-card shadow-lg px-2.5 py-3 text-brand-green transition-colors"
    >
      <Sipka />
      <span className="relative">
        <IkonaChatu />
        {neprectene > 0 && <Bublina>{neprectene}</Bublina>}
      </span>
      <span className="relative">
        <ChecklistIcon />
        {ukoly > 0 && <Bublina>{ukoly}</Bublina>}
      </span>
      {poTerminu > 0 && (
        <span className="relative text-white" title={`${poTerminu} po termínu`}>
          <ClockIcon />
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-heading font-bold leading-4 text-center">
            {poTerminu}
          </span>
        </span>
      )}
      <span className="text-[10px] font-heading font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
        MS chat
      </span>
    </button>
  );
}

function Bublina({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-4 text-center">
      {children}
    </span>
  );
}

function Sipka() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function IkonaChatu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
