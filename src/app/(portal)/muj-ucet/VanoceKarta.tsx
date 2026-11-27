'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * VÁNOČNÍ VÝZDOBA (zadání 27. 11. 2026, upřesněné týž den: „jako možnost
 * v profilu nastavení, ať už si to můžu zapnout i já teď a ostatním až od
 * 1. 12., ať to můžu testovat").
 *
 * Dvě řady přepínačů: SVOJE nastavení má každý a má přednost - kdo si dá
 * „Zapnout hned", vidí namrzlou lištu i v listopadu, aniž by ji viděl kdokoliv
 * další. Druhá řada je pro celý portál a vidí ji jen Žůžo-labůžo.
 *
 * Ukládá se hned, bez tlačítka - jako ostatní přepínače v Mém účtu. Texty
 * jsou psané tady a ne přes lib/jazyk.ts: v tom souboru běží překladová dávka.
 */
type Rezim = 'auto' | 'vzdy' | 'nikdy';

const MOJE: { klic: Rezim; nazev: string; popis: string }[] = [
  { klic: 'auto', nazev: 'Jako portál', popis: 'Řídím se tím, co platí pro celý portál.' },
  { klic: 'vzdy', nazev: 'Zapnout hned', popis: 'Vidím výzdobu i mimo sezónu - ostatních se to netýká.' },
  { klic: 'nikdy', nazev: 'Nechci', popis: 'Nevidím ji, ani když portál svítí všem.' },
];

const PORTAL: { klic: Rezim; nazev: string; popis: string }[] = [
  { klic: 'auto', nazev: 'Podle data', popis: 'Portál namrzne 1. prosince a rozmrzne 2. ledna.' },
  { klic: 'vzdy', nazev: 'Svítit pořád', popis: 'Výzdoba běží všem bez ohledu na datum.' },
  { klic: 'nikdy', nazev: 'Zhasnout', popis: 'Výzdobu neuvidí nikdo.' },
];

export function VanoceKarta({
  uMe,
  rezim,
  jsemSpravce,
  bezi,
}: {
  /** Moje volba. */
  uMe: Rezim;
  /** Volba pro celý portál. */
  rezim: Rezim;
  jsemSpravce: boolean;
  /** Je prosinec? Mimo sezónu se jen řekne, že se to zapne samo. */
  bezi: boolean;
}) {
  const router = useRouter();
  const [mne, setMne] = useState<Rezim>(uMe);
  const [portal, setPortal] = useState<Rezim>(rezim);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(telo: { uMe?: Rezim; rezim?: Rezim }) {
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch('/api/me/vanoce', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setChyba(data?.error || 'Uložení se nepodařilo.');
        // Vrátit přepínač zpátky, ať neukazuje něco, co se neuložilo.
        if (telo.uMe !== undefined) setMne(uMe);
        if (telo.rezim !== undefined) setPortal(rezim);
        return;
      }
      router.refresh();
    } catch {
      setChyba('Uložení se nepodařilo.');
    } finally {
      setUklada(false);
    }
  }

  const rada = (
    volby: { klic: Rezim; nazev: string; popis: string }[],
    vybrano: Rezim,
    zmen: (r: Rezim) => void,
  ) => (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {volby.map((v) => (
          <button
            key={v.klic}
            type="button"
            disabled={uklada}
            title={v.popis}
            onClick={() => zmen(v.klic)}
            className={`rounded-pill border px-3 py-1.5 text-xs font-heading font-semibold transition-colors ${
              vybrano === v.klic
                ? 'border-brand-green bg-brand-green text-onAccent'
                : 'border-line text-muted hover:text-brand-purple hover:border-brand-purple'
            }`}
          >
            {v.nazev}
          </button>
        ))}
      </div>
      <p className="text-xs font-body text-muted m-0">
        {volby.find((v) => v.klic === vybrano)?.popis}
      </p>
    </>
  );

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-ink m-0">Vánoční výzdoba</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Horní lišta namrzne - studený nádech a pár ledových krystalků na skle. Sama se zapne
          1. prosince a zhasne 2. ledna; portál se jinak nijak nemění.
          {!bezi && ' Teď není sezóna, takže je lišta čistá - leda že si ji zapneš níž.'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-heading uppercase tracking-wide text-muted">U mě</span>
        {rada(MOJE, mne, (r) => {
          setMne(r);
          void uloz({ uMe: r });
        })}
      </div>

      {jsemSpravce && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span className="text-[11px] font-heading uppercase tracking-wide text-muted">
            Celý portál
          </span>
          {rada(PORTAL, portal, (r) => {
            setPortal(r);
            void uloz({ rezim: r });
          })}
        </div>
      )}

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
    </div>
  );
}
