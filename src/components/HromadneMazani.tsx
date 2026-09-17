'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * LIŠTA HROMADNÉHO MAZÁNÍ NAD TABULKOU (zadání 17. 9. 2026 - smlouvy, pak
 * stornované faktury).
 *
 * Jedna lišta pro obě tabulky: liší se jen adresou, na kterou se seznam ID
 * pošle, a poznámkou pod tlačítkem. Kdyby si to každá tabulka psala po svém,
 * rozešly by se po první úpravě - a u mazání je to to poslední, co chceme.
 *
 * „VYBRAT VŠE" BERE JEN VIDITELNÉ ŘÁDKY (po hledání a filtrech), ne celou
 * záložku. Kdo si nejdřív vyfiltruje jednoho herce, nesmaže omylem i to, co
 * má odfiltrované pryč.
 *
 * Tlačítko se ptá podruhé: první klepnutí se přepne na „Opravdu smazat".
 * Okénko prohlížeče (confirm) se schválně nepoužívá - vypadá jinak než portál
 * a na telefonu je z něj překlep na jedno ťuknutí.
 */
export function HromadneMazani({
  viditelneIds,
  vybrane,
  onZmena,
  endpoint,
  poznamka,
}: {
  /** ID řádků, které jsou právě vidět. */
  viditelneIds: string[];
  vybrane: Set<string>;
  onZmena: (nove: Set<string>) => void;
  /** API, které přijme { ids: string[] }. */
  endpoint: string;
  /** Věta pod tlačítkem - co přesně se stane a co portál nedovolí. */
  poznamka: string;
}) {
  const router = useRouter();
  const [bezi, setBezi] = useState(false);
  const [potvrzeni, setPotvrzeni] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const vsechnyVybrane = viditelneIds.length > 0 && viditelneIds.every((id) => vybrane.has(id));

  function prepniVse() {
    setPotvrzeni(false);
    const dalsi = new Set(vybrane);
    if (vsechnyVybrane) viditelneIds.forEach((id) => dalsi.delete(id));
    else viditelneIds.forEach((id) => dalsi.add(id));
    onZmena(dalsi);
  }

  async function smaz() {
    if (vybrane.size === 0 || bezi) return;
    if (!potvrzeni) {
      setPotvrzeni(true);
      return;
    }
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...vybrane] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || 'Smazání se nezdařilo.');
        return;
      }
      onZmena(new Set());
      setPotvrzeni(false);
      // Seznam se skládá na serveru - bez tohohle by smazané řádky zůstaly.
      router.refresh();
    } catch {
      setChyba('Smazání se nezdařilo.');
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={vsechnyVybrane}
          disabled={viditelneIds.length === 0}
          onChange={prepniVse}
          className="w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-body text-ink">
          Vybrat vše{viditelneIds.length ? ` (${viditelneIds.length})` : ''}
        </span>
      </label>

      <span className="text-sm font-body text-muted tabular-nums">
        {vybrane.size > 0 ? `Vybráno: ${vybrane.size}` : 'Nic nevybráno'}
      </span>

      {vybrane.size > 0 && (
        <button
          type="button"
          onClick={() => {
            onZmena(new Set());
            setPotvrzeni(false);
          }}
          className="text-sm font-heading text-brand-purple hover:underline"
        >
          Zrušit výběr
        </button>
      )}

      <button
        type="button"
        onClick={() => void smaz()}
        disabled={vybrane.size === 0 || bezi}
        className={`ml-auto text-sm font-heading font-semibold rounded-pill border px-4 py-2 transition-colors disabled:opacity-50 ${
          potvrzeni
            ? 'border-danger text-danger bg-dangerTint'
            : 'border-line text-muted hover:border-danger hover:text-danger'
        }`}
      >
        {bezi
          ? 'Mažu…'
          : potvrzeni
            ? `Opravdu smazat ${vybrane.size}? Klepněte znovu`
            : `Smazat vybrané${vybrane.size ? ` (${vybrane.size})` : ''}`}
      </button>

      {chyba && <p className="text-sm font-body text-danger m-0 w-full">{chyba}</p>}
      <p className="text-xs font-body text-muted m-0 w-full">{poznamka}</p>
    </div>
  );
}

/** Zaškrtávátko v řádku tabulky - ať vypadá stejně v každém seznamu. */
export function VyberRadku({
  zaskrtnuto,
  onZmena,
  popisek,
}: {
  zaskrtnuto: boolean;
  onZmena: () => void;
  popisek: string;
}) {
  return (
    <input
      type="checkbox"
      checked={zaskrtnuto}
      onChange={onZmena}
      aria-label={popisek}
      className="w-4 h-4 accent-brand-purple cursor-pointer"
    />
  );
}
