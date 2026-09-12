'use client';

import { otevriDotazy } from '../components/DotazyDock';

/**
 * „Zeptat se" u projektu v klientské sekci (zadání 11. 9. 2026).
 *
 * OD 12. 9. 2026 JEN OTEVŘE DOK DOTAZŮ u toho projektu (zadání: „udělal bych
 * stabilní chat na pravé straně, jak to máme interně, kde by zůstávaly
 * konverzace k projektům"). Dřív to bylo samostatné modální okno; dvě různá
 * místa pro tutéž konverzaci znamenala, že se odpověď dala přehlédnout,
 * protože nikde nezůstávala na očích.
 */
export function ZeptatSe({ projectId, projectName }: { projectId: string; projectName: string }) {
  return (
    <button
      type="button"
      onClick={() => otevriDotazy(projectId)}
      title={`Zeptat se na projekt ${projectName}`}
      className="text-xs font-heading font-semibold text-brand-purple border border-brand-purple/40 hover:bg-tint rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
    >
      Zeptat se
    </button>
  );
}
