'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KresbaIkony, tridaBarvyIkony } from '@/lib/ikonyTypu';
import { VyberIkony } from './VyberIkony';

/**
 * DRUHY LICENCE (zadání 18. 9. 2026: „ty druhy licencí bych potřeboval taky
 * někde přidávat a editovat. Vytvořme pro ně i ikonky").
 *
 * Číselník stejného druhu jako typy projektu, proto sedí tady v Cenících:
 * hodnoty nejsou v kódu, tým si je spravuje sám. U projektu se pak zaškrtávají
 * a jeden projekt jich může mít víc — spot běží v TV i online.
 *
 * VYŘAZENÍ MÍSTO SMAZÁNÍ. Druh, který je u nějakého projektu zaškrtnutý, se
 * nemaže — jen se přestane nabízet u nových. Jinak by z projektu zmizel údaj,
 * který tam někdo vědomě dal.
 */
export type DruhLicenceRadek = {
  id: string;
  nazev: string;
  ikona: string | null;
  poradi: number;
  active: boolean;
  /** U kolika projektů je zaškrtnutý — kvůli hlášce u mazání. */
  projektu: number;
};

export function LicenceEditor({ druhy }: { druhy: DruhLicenceRadek[] }) {
  const router = useRouter();
  const [novy, setNovy] = useState({ nazev: '', ikona: '' });
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function poslat(url: string, method: string, body?: unknown) {
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setChyba(data?.error || 'Nepodařilo se to uložit.');
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function pridat() {
    if (!novy.nazev.trim()) return;
    const poradi = (druhy[druhy.length - 1]?.poradi ?? 0) + 10;
    const ok = await poslat('/api/admin/licence', 'POST', { ...novy, nazev: novy.nazev.trim(), poradi });
    if (ok) setNovy({ nazev: '', ikona: '' });
  }

  async function smazat(d: DruhLicenceRadek) {
    const otazka =
      d.projektu > 0
        ? `„${d.nazev}" je zaškrtnutý u ${d.projektu} projektů. Smazat nejde — vyřadí se, takže u nových projektů se už nenabídne. Pokračovat?`
        : `Opravdu smazat druh licence „${d.nazev}"?`;
    if (!window.confirm(otazka)) return;
    await poslat(`/api/admin/licence/${d.id}`, 'DELETE');
  }

  const vstup =
    'rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink placeholder:text-muted';

  return (
    <section className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl text-ink m-0">Druhy licence</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Zaškrtávají se u projektu a může jich být víc naráz. Vyřazený druh zůstane u projektů, kde už je,
          jen se nenabídne u nových.
        </p>
      </div>

      {chyba && <p className="text-sm font-body text-status-danger m-0">{chyba}</p>}

      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {druhy.map((d) => (
          <li
            key={d.id}
            className={`flex items-center gap-3 flex-wrap rounded-card border border-line px-3 py-2.5 ${
              d.active ? 'bg-field/50' : 'bg-field/20 opacity-60'
            }`}
          >
            <span
              className={`shrink-0 grid place-items-center w-8 h-8 rounded-full ${tridaBarvyIkony(d.ikona)}`}
            >
              {d.ikona ? <KresbaIkony klic={d.ikona} velikost={16} /> : <span className="text-xs">—</span>}
            </span>

            <input
              defaultValue={d.nazev}
              disabled={busy}
              onBlur={(e) => {
                const nazev = e.target.value.trim();
                if (nazev && nazev !== d.nazev) void poslat(`/api/admin/licence/${d.id}`, 'PATCH', { nazev });
              }}
              className={`${vstup} flex-1 min-w-[160px]`}
            />

            <VyberIkony
              hodnota={d.ikona}
              disabled={busy}
              onZmena={(ikona) => void poslat(`/api/admin/licence/${d.id}`, 'PATCH', { ikona })}
            />

            <label className="flex items-center gap-2 text-sm font-body text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={d.active}
                disabled={busy}
                onChange={(e) => void poslat(`/api/admin/licence/${d.id}`, 'PATCH', { active: e.target.checked })}
                className="w-4 h-4 accent-brand-purple"
              />
              Nabízet
            </label>

            <button
              type="button"
              disabled={busy}
              onClick={() => void smazat(d)}
              className="text-xs font-heading text-muted hover:text-status-danger"
            >
              Smazat
            </button>
          </li>
        ))}
        {druhy.length === 0 && (
          <li className="text-sm font-body text-muted">Zatím tu žádný druh licence není.</li>
        )}
      </ul>

      <div className="flex items-center gap-2 flex-wrap border-t border-line pt-4">
        <input
          value={novy.nazev}
          disabled={busy}
          onChange={(e) => setNovy({ ...novy, nazev: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void pridat();
            }
          }}
          placeholder="Nový druh licence (např. Kino)"
          className={`${vstup} flex-1 min-w-[200px]`}
        />
        <VyberIkony
          hodnota={novy.ikona || null}
          disabled={busy}
          onZmena={(ikona) => setNovy({ ...novy, ikona })}
        />
        <button
          type="button"
          disabled={busy || !novy.nazev.trim()}
          onClick={() => void pridat()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          Přidat
        </button>
      </div>
    </section>
  );
}
