'use client';

import { useState } from 'react';

/**
 * Prodleva zpráv klientovi po změně stavu (zadání 22. 9. 2026: „z bezpečnostních
 * důvodů latenci ... 10s ... hromadně nastavit"). Platí pro všechny firmy.
 */
export function ProdlevaNotifikaci({ pocatecni, max }: { pocatecni: number; max: number }) {
  const [hodnota, setHodnota] = useState(String(pocatecni));
  const [ulozeno, setUlozeno] = useState(pocatecni);
  const [pracuje, setPracuje] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz() {
    const sekund = Number(hodnota);
    if (!Number.isInteger(sekund) || sekund < 0 || sekund > max) {
      setChyba(`Zadejte celé číslo od 0 do ${max}.`);
      return;
    }
    setPracuje(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/admin/notifikace-prodleva', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sekund }),
      });
      const data = (await res.json().catch(() => ({}))) as { sekund?: number; error?: string };
      if (!res.ok) {
        setChyba(data.error || 'Uložení se nezdařilo.');
        return;
      }
      setUlozeno(data.sekund ?? sekund);
      setHodnota(String(data.sekund ?? sekund));
      setHlaska('Uloženo.');
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div>
        <h2 className="font-heading font-semibold text-base text-ink m-0">Prodleva odeslání po změně stavu</h2>
        <p className="text-sm font-body text-muted m-0 mt-1 max-w-[75ch]">
          Zpráva klientovi neodejde hned po přehození stavu, ale až po této době. Když se stav mezitím
          změní jinam (překlep, špatný projekt), zpráva k původnímu stavu neodejde vůbec. Platí pro
          všechny firmy. 0 = posílat hned.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="number"
          min={0}
          max={max}
          value={hodnota}
          onChange={(e) => setHodnota(e.target.value)}
          className="w-24 rounded-lg border border-line bg-field px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
        />
        <span className="text-sm font-body text-muted">sekund</span>
        <button
          type="button"
          onClick={uloz}
          disabled={pracuje || hodnota === String(ulozeno)}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {pracuje ? 'Ukládám…' : 'Uložit'}
        </button>
        {hlaska && <span className="text-sm font-body text-ink">{hlaska}</span>}
        {chyba && <span className="text-sm font-body text-danger">{chyba}</span>}
      </div>
    </div>
  );
}
