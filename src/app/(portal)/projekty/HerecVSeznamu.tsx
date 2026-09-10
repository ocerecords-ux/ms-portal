'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BublinaHerce, VyberHerce, type Herec } from './VyberHerce';

/**
 * Herec v přehledu projektů jako bublina (zadání 10. 9. 2026: „s těmi jmény
 * herců bych pracoval v bublině, jako s celky, ne s textem, aby bylo jasné,
 * že je to výběr").
 *
 * Bublina tady není jen ozdoba - opravdu se přes ni vybírá. Kdyby jen
 * vypadala jako výběr a nešlo na ni kliknout, byla by to lež: v tabulce už
 * takhle funguje stav i priorita.
 *
 * Když projekt herce ještě nemá přiřazený účet, ukáže se jméno z Caflou -
 * ale šedě a bez bubliny, protože to je jen text, na kterém nic nestojí.
 */
export function HerecVSeznamu({
  caflouProjectId,
  herci,
  /** ID přiřazeného účtu herce, nebo prázdno. */
  actorUserId,
  /** Jméno, které se má ukázat - účet, nebo text z Caflou. */
  jmeno,
  muzeMenit,
}: {
  caflouProjectId: string;
  herci: Herec[];
  actorUserId: string | null;
  jmeno: string | null;
  muzeMenit: boolean;
}) {
  const router = useRouter();
  const [vybira, setVybira] = useState(false);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const obal = useRef<HTMLDivElement>(null);

  // Klik mimo výběr ho zavře - jinak by nabídka zůstala viset přes řádky pod.
  useEffect(() => {
    if (!vybira) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setVybira(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [vybira]);

  async function uloz(id: string) {
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/projects/${caflouProjectId}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorUserId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Herce se nepodařilo uložit.');
        return;
      }
      setVybira(false);
      router.refresh();
    } catch {
      setChyba('Herce se nepodařilo uložit.');
    } finally {
      setUklada(false);
    }
  }

  if (!muzeMenit) {
    return jmeno ? (
      <span className="inline-flex items-center rounded-pill bg-brand-purple/12 text-brand-purpleDeep dark:text-brand-purpleLight px-3 py-1 text-sm font-heading font-semibold">
        {jmeno}
      </span>
    ) : (
      <span className="text-muted">—</span>
    );
  }

  if (vybira) {
    return (
      <div ref={obal} className="min-w-[220px]">
        <VyberHerce
          herci={herci}
          hodnota={actorUserId ?? ''}
          onZmena={(id) => void uloz(id)}
          disabled={uklada}
        />
        {chyba && <span className="block text-[11px] font-body text-danger mt-0.5">{chyba}</span>}
      </div>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {actorUserId && jmeno ? (
        <BublinaHerce
          jmeno={jmeno}
          disabled={uklada}
          onZmenit={() => setVybira(true)}
          onOdebrat={() => void uloz('')}
        />
      ) : (
        <button
          type="button"
          onClick={() => setVybira(true)}
          title={jmeno ? 'Přiřadit účet herce' : 'Vybrat herce'}
          className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-line px-3 py-1 text-sm font-heading text-muted hover:text-ink hover:border-brand-purple transition-colors"
        >
          {/* Jmeno z Caflou je jen text, na kterem nic nestoji - ukazujeme ho
              jako vodítko, dokud u projektu ucet herce neni. */}
          {jmeno ? <span className="truncate max-w-[160px]">{jmeno}</span> : <span>+ herec</span>}
        </button>
      )}
      {chyba && <span className="text-[11px] font-body text-danger">{chyba}</span>}
    </span>
  );
}
