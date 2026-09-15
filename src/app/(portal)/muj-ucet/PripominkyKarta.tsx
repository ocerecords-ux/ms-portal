'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PripominkaRadek } from '@/lib/pripominkyServer';

/**
 * Seznam připomínek k portálu v „Mém účtu" (zadání 15. 9. 2026: „mě by se
 * objevoval nějaký seznam - to do list, roztříděný od každého uživatele
 * a všechny připomínky bych viděl jen já ve svém profilu").
 *
 * DVĚ PODOBY TÉHOŽ MÍSTA:
 *   - Žůžo-labůžo vidí VŠECHNY připomínky roztříděné po lidech a odškrtává je.
 *   - Kdokoliv jiný vidí jen svoje, které ještě čekají. Odškrtnutá zmizí
 *     („já bych si to pak jen odškrtával a jim by to mizelo").
 */
export function PripominkyKarta({
  otevrene,
  hotove,
  jsemSpravce,
}: {
  otevrene: PripominkaRadek[];
  hotove: PripominkaRadek[];
  jsemSpravce: boolean;
}) {
  const router = useRouter();
  const [zalozka, setZalozka] = useState<'otevrene' | 'hotove'>('otevrene');
  const [pracuje, setPracuje] = useState<string | null>(null);
  const [nahled, setNahled] = useState<string | null>(null);

  const seznam = zalozka === 'otevrene' ? otevrene : hotove;

  /** Roztříděno podle člověka - přesně to, co bylo v zadání. */
  const poLidech = useMemo(() => {
    const mapa = new Map<string, { autor: string; polozky: PripominkaRadek[] }>();
    seznam.forEach((p) => {
      const zaznam = mapa.get(p.autorId) ?? { autor: p.autor, polozky: [] };
      zaznam.polozky.push(p);
      mapa.set(p.autorId, zaznam);
    });
    return [...mapa.values()].sort((a, b) => b.polozky.length - a.polozky.length);
  }, [seznam]);

  async function odskrtni(id: string, hotovo: boolean) {
    setPracuje(id);
    try {
      await fetch(`/api/pripominky/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotovo }),
      });
      router.refresh();
    } finally {
      setPracuje(null);
    }
  }

  async function smaz(id: string) {
    setPracuje(id);
    try {
      await fetch(`/api/pripominky/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setPracuje(null);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Připomínky k portálu
          </h2>
          <p className="text-xs font-body text-muted m-0 mt-1">
            {jsemSpravce
              ? 'Co lidem v portálu vadí. Odškrtnutá položka jim zmizí ze seznamu.'
              : 'Co jste poslali. Až to bude hotové, položka zmizí.'}
          </p>
        </div>
        {jsemSpravce && (
          <div className="flex gap-1 bg-field rounded-pill p-1">
            {(['otevrene', 'hotove'] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZalozka(z)}
                className={`rounded-pill px-3 py-1 text-xs font-heading ${
                  zalozka === z ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                }`}
              >
                {z === 'otevrene' ? `Čeká (${otevrene.length})` : `Hotové (${hotove.length})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {seznam.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          {jsemSpravce
            ? zalozka === 'otevrene'
              ? 'Nic nečeká. Lidem se portál zatím líbí.'
              : 'Zatím nic odškrtnutého.'
            : 'Zatím jste nic neposlali. Bublina v horní liště je na to.'}
        </p>
      ) : jsemSpravce ? (
        <div className="flex flex-col gap-5">
          {poLidech.map((skupina) => (
            <div key={skupina.autor} className="flex flex-col gap-2">
              <p className="text-xs font-heading font-semibold text-ink uppercase tracking-wide m-0">
                {skupina.autor} <span className="text-muted font-normal">({skupina.polozky.length})</span>
              </p>
              {skupina.polozky.map((p) => (
                <Polozka
                  key={p.id}
                  p={p}
                  jsemSpravce
                  pracuje={pracuje === p.id}
                  onOdskrtnout={() => odskrtni(p.id, p.stav === 'NOVA')}
                  onSmazat={() => smaz(p.id)}
                  onNahled={setNahled}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {seznam.map((p) => (
            <Polozka
              key={p.id}
              p={p}
              jsemSpravce={false}
              pracuje={pracuje === p.id}
              onSmazat={() => smaz(p.id)}
              onNahled={setNahled}
            />
          ))}
        </div>
      )}

      {nahled && (
        <div
          onClick={() => setNahled(null)}
          className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-6 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={nahled} alt="Printscreen" className="max-w-full max-h-full rounded-card shadow-lg" />
        </div>
      )}
    </div>
  );
}

function Polozka({
  p,
  jsemSpravce,
  pracuje,
  onOdskrtnout,
  onSmazat,
  onNahled,
}: {
  p: PripominkaRadek;
  jsemSpravce: boolean;
  pracuje: boolean;
  onOdskrtnout?: () => void;
  onSmazat: () => void;
  onNahled: (url: string) => void;
}) {
  const datum = new Date(p.createdAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });

  return (
    <div className={`rounded-lg border border-line bg-field/60 px-3 py-2.5 flex gap-3 ${pracuje ? 'opacity-60' : ''}`}>
      {jsemSpravce && (
        <input
          type="checkbox"
          checked={p.stav === 'HOTOVA'}
          onChange={onOdskrtnout}
          disabled={pracuje}
          title={p.stav === 'HOTOVA' ? 'Vrátit mezi čekající' : 'Odškrtnout'}
          className="mt-1 w-4 h-4 shrink-0 accent-brand-green cursor-pointer"
        />
      )}
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <p className={`text-sm font-body m-0 ${p.stav === 'HOTOVA' ? 'text-muted line-through' : 'text-ink'}`}>
          {p.text}
        </p>
        <p className="text-[11px] font-body text-muted m-0 flex flex-wrap gap-x-3">
          <span>{datum}</span>
          {p.odkud && <span>{p.odkud}</span>}
          {p.pridalSe > 0 && <span className="text-brand-purpleDark">+{p.pridalSe} další hlásí totéž</span>}
          {p.stav === 'HOTOVA' && p.hotovoJmeno && <span>odškrtl {p.hotovoJmeno}</span>}
        </p>
        {p.prilohy.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {p.prilohy.map((o) => (
              <button key={o.id} type="button" onClick={() => onNahled(o.url)} title="Zvětšit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.url} alt={o.nazev} className="w-14 h-14 object-cover rounded border border-line" />
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSmazat}
        disabled={pracuje}
        title="Smazat připomínku"
        aria-label="Smazat připomínku"
        className="text-muted hover:text-danger text-sm leading-none self-start"
      >
        ×
      </button>
    </div>
  );
}
