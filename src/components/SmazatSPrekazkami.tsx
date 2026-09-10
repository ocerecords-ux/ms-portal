'use client';

import { useState } from 'react';
import type { Prekazka } from '@/lib/mazani';

/**
 * Smazání firmy / uživatele / projektu, na kterém něco visí (zadání
 * 10. 9. 2026: „nechal bych to, že to zavře, že tam jsou navázané věci, ale
 * pak se ještě můžu rozhodnout, zda o ně přijdu, nebo ty věci konkrétní
 * archivuju a smažu uživatele, firmu atd.").
 *
 * TŘI KROKY, ZÁMĚRNĚ. Kliknutí → portál se zeptá databáze, co na záznamu
 * visí → teprve když je ten seznam vidět, nabídnou se dvě cesty. Jedno
 * kliknutí by znamenalo mazat naslepo.
 *
 * Archivovat je první a je to ta doporučená cesta: archiv se dá stáhnout,
 * takže překlep není konec světa. Smazat bez archivu je vedle jako obyčejný
 * odkaz - jde to, ale nevypadá to jako výchozí volba.
 */
export function SmazatSPrekazkami({
  /** Kam se posílá DELETE - bez parametru zpusob, ten se doplní. */
  url,
  /** „Firmu Audioteka", „Účet Jan Novák", „Projekt Malý princ". */
  co,
  /** Co se stane po smazání - obvykle přesměrování. */
  onSmazano,
  popisek = 'Smazat',
}: {
  url: string;
  co: string;
  onSmazano: () => void;
  popisek?: string;
}) {
  const [prekazky, setPrekazky] = useState<Prekazka[] | null>(null);
  const [ptaSe, setPtaSe] = useState(false);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  /** První kliknutí: zkusí smazat. Když něco visí, vrátí se seznam. */
  async function zkus(zpusob?: 'archivovat' | 'smazat-vse') {
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(zpusob ? `${url}?zpusob=${zpusob}` : url, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(data?.prekazky) && data.prekazky.length > 0) {
        setPrekazky(data.prekazky);
        setPtaSe(true);
        return;
      }
      if (!res.ok) {
        setChyba(data?.error || 'Smazání se nezdařilo.');
        setPtaSe(false);
        return;
      }
      onSmazano();
    } catch {
      setChyba('Smazání se nezdařilo.');
    } finally {
      setPracuje(false);
    }
  }

  if (!ptaSe) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void zkus()}
          disabled={pracuje}
          className="self-start font-heading font-semibold text-sm text-danger hover:underline disabled:opacity-60"
        >
          {pracuje ? 'Pracuji…' : popisek}
        </button>
        {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}
      </div>
    );
  }

  return (
    <div className="border border-danger/40 bg-dangerTint rounded-card p-4 flex flex-col gap-3">
      <div>
        <p className="font-heading font-semibold text-sm text-ink m-0">{co} nejde rovnou smazat.</p>
        <p className="text-sm font-body text-muted m-0 mt-1">Visí na něm:</p>
        <ul className="text-sm font-body text-ink mt-1 mb-0 pl-5">
          {prekazky?.map((p) => (
            <li key={p.co}>
              {p.pocet}× {p.co}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm font-body text-muted m-0">
        Archiv uloží všechno navázané stranou (jde stáhnout ze sekce Archiv) a teprve pak to
        z portálu odstraní. Doklady se u projektu neruší, jen se odpojí — název projektu si nesou
        textem, takže v účetnictví zůstanou čitelné.
      </p>

      {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => void zkus('archivovat')}
          disabled={pracuje}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {pracuje ? 'Pracuji…' : 'Archivovat a smazat'}
        </button>
        <button
          type="button"
          onClick={() => void zkus('smazat-vse')}
          disabled={pracuje}
          className="font-heading font-semibold text-sm text-danger hover:underline disabled:opacity-60"
        >
          Smazat bez archivu
        </button>
        <button
          type="button"
          onClick={() => {
            setPtaSe(false);
            setChyba(null);
          }}
          className="font-heading font-semibold text-sm text-muted hover:text-ink ml-auto"
        >
          Nechat být
        </button>
      </div>
    </div>
  );
}
