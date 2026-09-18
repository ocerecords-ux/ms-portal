'use client';

import { useEffect, useRef, useState } from 'react';
import { TRIDA_BUBLINY_HERCE } from '@/lib/bublinaHerce';

export type NakladovaPolozka = { nazev: string; castka: number };

const czk = (v: number) => `${Math.round(v).toLocaleString('cs-CZ')} Kč`;

/** Text z pole na koruny. Prázdno i nesmysl je nula. */
function cislo(text: string): number {
  const n = Number(String(text).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Položkové náklady projektu (zadání 11. 9. 2026: „do té karty mi dej třeba
 * položkové menu náklady, tak napíšu náklady na herce a tak dále").
 *
 * Ukládá se samo — stejně jako zbytek detailu projektu, kde tlačítko Uložit
 * od 11. 9. 2026 není („co přepneš, to tam je"). Zápis odchází se zpožděním,
 * aby se neposílal po každém písmenu.
 */
export function NakladyProjektu({
  caflouProjectId,
  pocatecni,
  onZmena,
  nadpis = 'Náklady po položkách',
  napoveda = 'Bez DPH. Sem patří všechny náklady zakázky — honorář, studio, hudba. Zisk se počítá z nich.',
  jmena = [],
}: {
  caflouProjectId: string;
  pocatecni: NakladovaPolozka[];
  /** Součet nahoru do rozpočtu, ať se čerpání přepočítá hned. */
  onZmena?: (soucet: number) => void;
  /** U audioknihy na klíč se tomu říká jinak - viz ProjectBudget. */
  nadpis?: string;
  napoveda?: string;
  /**
   * Jména herců z databáze - jen jako NÁPOVĚDA (zadání 14. 9. 2026: „chci
   * tady mít možnost přidat konkrétního herce z databáze, ale i cokoli
   * napsat v textu. Chci to jen našeptávat").
   *
   * Není to výběr ze seznamu: honorář se platí i tomu, kdo v portálu účet
   * nemá, a řádek může být klidně „studio Brno" nebo „úprava textu". Proto
   * se vybrané jméno jen vepíše do pole a dá se přepsat.
   */
  jmena?: string[];
}) {
  /**
   * ČÁSTKA SE DRŽÍ JAKO TEXT, ne jako číslo (14. 9. 2026: „zase tam musím
   * nejdříve smazat nulu v tom poli"). Nový řádek měl v částce nulu, kterou
   * musel člověk před psaním smazat. Prázdné pole ale číslem zapsat nejde -
   * `0` a „nevyplněno" by byly totéž. Na číslo se to převede až při ukládání.
   */
  const [polozky, setPolozky] = useState<{ nazev: string; castka: string }[]>(() =>
    pocatecni.map((p) => ({ nazev: p.nazev, castka: p.castka ? String(p.castka) : '' })),
  );
  const [stav, setStav] = useState<'nic' | 'uklada' | 'ulozeno' | 'chyba'>('nic');
  const prvniRef = useRef(true);

  const soucet = polozky.reduce((s, p) => s + cislo(p.castka), 0);

  useEffect(() => {
    onZmena?.(soucet);
  }, [soucet, onZmena]);

  // Ulozeni se zpozdenim - jinak by odchazel zapis po kazdem pismenu.
  useEffect(() => {
    if (prvniRef.current) {
      prvniRef.current = false;
      return;
    }
    const cas = setTimeout(async () => {
      setStav('uklada');
      try {
        const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/naklady`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            polozky: polozky.map((p) => ({ nazev: p.nazev, castka: Math.round(cislo(p.castka)) })),
          }),
        });
        setStav(res.ok ? 'ulozeno' : 'chyba');
      } catch {
        setStav('chyba');
      }
    }, 900);
    return () => clearTimeout(cas);
  }, [polozky, caflouProjectId]);

  function uprav(i: number, zmena: Partial<{ nazev: string; castka: string }>) {
    setPolozky((s) => s.map((p, j) => (j === i ? { ...p, ...zmena } : p)));
  }

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">{nadpis}</span>
        <span className="text-xs font-heading text-muted">
          {stav === 'uklada' ? 'Ukládám…' : stav === 'ulozeno' ? '✓ Uloženo' : stav === 'chyba' ? 'Neuložilo se' : ''}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {polozky.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <PoleSNapovedou
              hodnota={p.nazev}
              onZmena={(v) => uprav(i, { nazev: v })}
              jmena={jmena}
            />
            <input
              type="number"
              value={p.castka}
              onChange={(e) => uprav(i, { castka: e.target.value })}
              placeholder="0"
              className="w-32 rounded-lg border border-line bg-field px-3 py-1.5 text-ink font-heading text-sm text-right tabular-nums outline-none focus:border-brand-purple"
            />
            <span className="text-xs font-heading text-muted w-6">Kč</span>
            <button
              type="button"
              onClick={() => setPolozky((s) => s.filter((_, j) => j !== i))}
              title="Smazat položku"
              className="text-muted hover:text-danger text-sm shrink-0 px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mt-2">
        <button
          type="button"
          onClick={() => setPolozky((s) => [...s, { nazev: '', castka: '' }])}
          className="text-xs font-heading font-semibold text-brand-purple hover:underline"
        >
          + Přidat položku
        </button>
        {polozky.length > 0 && (
          <span className="text-sm font-heading text-ink tabular-nums">
            Položky celkem <strong>{czk(soucet)}</strong>
          </span>
        )}
      </div>
      <p className="text-xs font-body text-muted mt-1.5 m-0">{napoveda}</p>
    </div>
  );
}

/**
 * Políčko s názvem položky a našeptáváním jmen (zadání 14. 9. 2026).
 *
 * VÍTĚZÍ NAPSANÝ TEXT, ne seznam. Nabídka se ukáže, jen když se do políčka
 * píše a něco se trefí; kliknutím se jméno vepíše a dá se dál upravovat.
 * Kdo v portálu účet nemá, se prostě napíše celý - proto tu není výběr,
 * ze kterého by se nedalo vystoupit.
 */
/** Porovnávací tvar jména - bez diakritiky, malými písmeny. */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function PoleSNapovedou({
  hodnota,
  onZmena,
  jmena,
}: {
  hodnota: string;
  onZmena: (v: string) => void;
  jmena: string[];
}) {
  const [otevreno, setOtevreno] = useState(false);
  // Rozepsaná položka: dokud se v ní píše, je to obyčejné pole. Jakmile
  // sedne na herce z databáze, ukáže se jako bublina - viz níž.
  const [upravuje, setUpravuje] = useState(false);
  const obal = useRef<HTMLDivElement>(null);
  const poleRef = useRef<HTMLInputElement>(null);

  // Nabidku zavira klik MIMO ni - blur prijde uz pri zmacknuti tlacitka mysi,
  // takze by se polozka pod kurzorem stihla ztratit driv, nez by se na ni
  // kliklo. Stejne to resi i vyber projektu.
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  const hledany = zjednodus(hodnota);
  const nalezena = hledany
    ? jmena.filter((j) => zjednodus(j).includes(hledany) && zjednodus(j) !== hledany).slice(0, 6)
    : [];

  /**
   * HEREC Z DATABÁZE SE POZNÁ NA PRVNÍ POHLED (zadání 15. 9. 2026: „když
   * přidávám herce do nákladů, chtěl by, ať se identifikuje herec z databáze.
   * Ať je to jasné, tak by tam mohl naskočit v té bublině, jak máme
   * u projektu").
   *
   * Řádek nákladů je pořád obyčejný text - honorář se platí i tomu, kdo
   * v portálu účet nemá, a položka může být klidně „studio Brno". Když ale
   * napsané jméno sedne na herce z databáze, vykreslí se jako fialová bublina,
   * úplně stejná jako u projektu. Kliknutím se zase rozepíše.
   */
  const herecZDatabaze = hodnota.trim() ? jmena.find((j) => zjednodus(j) === hledany) ?? null : null;

  if (herecZDatabaze && !upravuje) {
    return (
      <div className="relative flex-1 min-w-0">
        <button
          type="button"
          onClick={() => {
            setUpravuje(true);
            setTimeout(() => poleRef.current?.focus(), 0);
          }}
          title="Upravit položku"
          className="w-full rounded-lg border border-line bg-field px-2 py-1 text-left flex items-center min-h-[34px]"
        >
          <span
            className={`inline-flex items-center max-w-full whitespace-nowrap px-3 py-0.5 text-sm font-heading font-semibold truncate ${TRIDA_BUBLINY_HERCE}`}
          >
            {herecZDatabaze}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={obal} className="relative flex-1 min-w-0">
      <input
        ref={poleRef}
        type="text"
        value={hodnota}
        onChange={(e) => {
          onZmena(e.target.value);
          setOtevreno(true);
        }}
        onFocus={() => setOtevreno(true)}
        onBlur={() => setUpravuje(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && otevreno) {
            e.preventDefault();
            e.stopPropagation();
            setOtevreno(false);
          }
        }}
        placeholder="Honorář herce, studio, hudba…"
        className="w-full rounded-lg border border-line bg-field px-3 py-1.5 text-ink font-body text-sm outline-none focus:border-brand-purple"
      />
      {otevreno && nalezena.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-line bg-surface shadow-lg overflow-hidden">
          {nalezena.map((j) => (
            <button
              key={j}
              type="button"
              // Bez tohohle by kliknuti sebralo focus policku a nabidka by
              // problikla driv, nez by se stihl vyber.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onZmena(j);
                setUpravuje(false);
                setOtevreno(false);
              }}
              className="w-full text-left px-3 py-2 text-sm font-body text-ink hover:bg-surfaceSoft"
            >
              {j}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
