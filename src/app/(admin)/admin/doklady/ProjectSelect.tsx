'use client';

import { useState } from 'react';
import { VyberPole } from '@/components/VyberPole';

export type ProjectChoice = { id: string; label: string; finished: boolean };

/**
 * Výběr projektu u dokladu (zadani 8. 9. 2026). Jedno místo pro nabídku,
 * fakturu i výdaj, aby se to všude chovalo stejně.
 *
 * Nabízejí se JEN ROZPRACOVANÉ projekty (zadání 10. 9. 2026: „když vybírám
 * u faktury projekt, je tam brutální seznam"). Dokončených jsou stovky a
 * v rozbalovacím seznamu se v nich nedá nic najít.
 *
 * Dvě výjimky, aby se nic neztratilo: projekt, který už je u dokladu uložený,
 * se nabídne vždycky — i když je mezitím dokončený nebo z Caflou zmizel.
 * Doklad k dokončenému projektu tak jde dál otevřít a uložit, jen se k němu
 * nový nepřiřadí omylem.
 *
 * UKONČENÉ NA POŽÁDÁNÍ (zadání 21. 9. 2026: „potřebuju přidat výdaje i na
 * ukončený projekt"). Poslední volba seznamu „Zobrazit i ukončené projekty"
 * je přidá pod rozpracované - výchozí seznam zůstává krátký.
 */
const UKAZ_UKONCENE = '__ukoncene__';

export function ProjectSelect({
  value,
  onChange,
  projects,
  currentName,
  disabled,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  projects: ProjectChoice[];
  currentName?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const [iUkoncene, setIUkoncene] = useState(false);
  const rozpracovane = projects.filter((p) => !p.finished);
  const ukoncene = iUkoncene ? projects.filter((p) => p.finished && p.id !== value) : [];
  // Projekt uz ulozeny u dokladu: bud je mezi dokoncenymi, nebo v seznamu
  // vubec neni. V obou pripadech se musi nabidnout, jinak by ho ulozeni
  // shodilo.
  const ulozeny = value ? projects.find((p) => p.id === value) : undefined;
  const mimoNabidku = Boolean(value) && !rozpracovane.some((p) => p.id === value);

  return (
    <VyberPole
      value={value}
      onChange={(e) => {
        if (e.target.value === UKAZ_UKONCENE) {
          setIUkoncene(true);
          return;
        }
        onChange(e.target.value);
      }}
      disabled={disabled}
      className={className}
    >
      <option value="">— bez projektu —</option>
      {mimoNabidku && (
        <option value={value}>{ulozeny?.label || currentName || `Projekt ${value}`}</option>
      )}
      {rozpracovane.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
      {ukoncene.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label} (ukončený)
        </option>
      ))}
      {!iUkoncene && projects.some((p) => p.finished) && (
        <option value={UKAZ_UKONCENE}>+ Zobrazit i ukončené projekty…</option>
      )}
    </VyberPole>
  );
}
