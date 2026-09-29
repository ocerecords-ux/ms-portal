'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { posun, seradZalozky, type Zalozka } from '@/lib/zalozky';

/**
 * LIŠTA ZÁLOŽEK S VLASTNÍM POŘADÍM (zadání 29. 9. 2026: „na ty záložky karet
 * bych dal taky možnost si změnit individuálně pořadí, ať si každý uživatel
 * udělá, jak chce").
 *
 * Jedna komponenta pro všechny lišty v portálu - Doklady, Přehledy,
 * nastavení sekcí. Vypadaly stejně už dřív, takže nemá smysl mít tři skoro
 * stejné soubory a přeskládávání psát třikrát.
 *
 * PŘESKLÁDÁVÁ SE ŠIPKAMI, NE TAŽENÍM. Lišta se používá i na dotykovém displeji
 * a v mobilu, kde je vodorovně posuvná - tažení by se pralo s posouváním lišty
 * a na úzké obrazovce by se do záložky nikdo netrefil. Šipka vlevo/vpravo
 * funguje všude stejně a jde na ni i z klávesnice.
 *
 * Pořadí se ukládá hned po každém přesunu. Kdyby se uložení nepovedlo,
 * záložky zůstanou přeskládané do konce návštěvy a příště se vrátí - to je
 * lepší než vracet je člověku pod rukama.
 */
export function ZalozkyLista({
  sekce,
  zalozky,
  poradi,
}: {
  /** Která lišta - pod tímhle klíčem se pořadí ukládá. */
  sekce: string;
  zalozky: Zalozka[];
  /** Uložené pořadí ze serveru; prázdné = výchozí pořadí z kódu. */
  poradi: string[];
}) {
  const pathname = usePathname();
  const [klice, setKlice] = useState<string[]>(poradi);
  const [upravuji, setUpravuji] = useState(false);
  const [chyba, setChyba] = useState(false);

  // Když se seznam záložek změní (přibude právo na Banku), pořadí se
  // dopočítá znovu - viz seradZalozky.
  useEffect(() => setKlice(poradi), [poradi]);

  const serazene = seradZalozky(zalozky, klice);

  /**
   * Aktivní je ta záložka, jejíž adresa sedí na začátek cesty. Bere se
   * NEJDELŠÍ shoda, jinak by se u vnořených adres podtrhly dvě najednou.
   */
  const aktivni = [...zalozky]
    .sort((a, b) => b.href.length - a.href.length)
    .find((z) => pathname === z.href || pathname?.startsWith(`${z.href}/`))?.href;

  async function uloz(nove: string[]) {
    setKlice(nove);
    setChyba(false);
    try {
      const res = await fetch('/api/zalozky', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sekce, poradi: nove }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChyba(true);
    }
  }

  const prehod = (index: number, smer: -1 | 1) =>
    void uloz(posun(serazene, index, index + smer).map((z) => z.klic));

  const zalozkaTrida = (jeAktivni: boolean) =>
    `shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors no-underline ${
      jeAktivni ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
    }`;

  return (
    <div className="flex items-end gap-2 border-b border-line">
      {/* Na telefonu jeden posuvný řádek (21. 9. 2026), od tabletu se lámou. */}
      <nav className="flex items-center gap-1 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden grow">
        {serazene.map((z, i) =>
          upravuji ? (
            <span
              key={z.klic}
              className="shrink-0 inline-flex items-center gap-1 rounded-t-lg -mb-px border border-b-0 border-dashed border-line bg-field px-1.5 py-1"
            >
              <button
                type="button"
                onClick={() => prehod(i, -1)}
                disabled={i === 0}
                aria-label={`Posunout ${z.nazev} doleva`}
                className="px-1.5 py-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted"
              >
                ‹
              </button>
              <span className="text-sm font-heading font-semibold text-ink whitespace-nowrap">{z.nazev}</span>
              <button
                type="button"
                onClick={() => prehod(i, 1)}
                disabled={i === serazene.length - 1}
                aria-label={`Posunout ${z.nazev} doprava`}
                className="px-1.5 py-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:hover:text-muted"
              >
                ›
              </button>
            </span>
          ) : (
            <Link
              key={z.klic}
              href={z.href}
              aria-current={aktivni === z.href ? 'page' : undefined}
              className={zalozkaTrida(aktivni === z.href)}
            >
              {z.nazev}
            </Link>
          ),
        )}
      </nav>

      <div className="shrink-0 flex items-center gap-2 pb-1.5">
        {chyba && <span className="text-xs font-body text-danger">neuloženo</span>}
        {upravuji && klice.length > 0 && (
          <button
            type="button"
            onClick={() => void uloz([])}
            className="text-xs font-body text-muted hover:text-ink underline"
          >
            Výchozí
          </button>
        )}
        <button
          type="button"
          onClick={() => setUpravuji((u) => !u)}
          title={upravuji ? 'Hotovo' : 'Přeskládat záložky'}
          aria-label={upravuji ? 'Hotovo' : 'Přeskládat záložky'}
          className={`p-1.5 rounded-lg border transition-colors ${
            upravuji ? 'border-brand-purple text-brand-purple' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {upravuji ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l4.5 4.5L19 7" />
            </svg>
          ) : (
            // Šipky doleva a doprava - „tady se s tím dá hýbat".
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 7L4 12l4 5M16 7l4 5-4 5M4 12h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
