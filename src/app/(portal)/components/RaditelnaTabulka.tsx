'use client';

import { useMemo, useState, type ReactNode } from 'react';

/**
 * Tabulka, která se řadí kliknutím na název sloupce (zadání 9. 9. 2026:
 * "musíme dát řazení podle sloupců ve všech tabulkách, jen kliknutím na
 * název").
 *
 * Vznikla proto, aby řazení nebylo v každé tabulce napsané znovu a pokaždé
 * trochu jinak. Do té doby uměly řadit jen tři tabulky z patnácti a každá
 * po svém.
 *
 * Stránky, které data načítají (server), zůstávají serverové - předají sem
 * jen hotové řádky. Definice sloupců i vykreslení buněk žijí tady, v klientu,
 * takže se smí použít i funkce a odkazy.
 */

export type SmerRazeni = 'asc' | 'desc';

export type SloupecTabulky<T> = {
  /** Vlastní klíč sloupce, používá se jen pro stav řazení. */
  key: string;
  label: string;
  /** Obsah buňky. */
  bunka: (radek: T) => ReactNode;
  /**
   * Hodnota, podle které se řadí. Vrací číslo (peníze, počty, datum jako čas)
   * nebo text; null a prázdný text znamenají "nevyplněno".
   *
   * Když chybí, sloupec se řadit nedá - hodí se u sloupců s tlačítky.
   */
  hodnota?: (radek: T) => string | number | null;
  /** Čísla a peníze patří doprava. */
  vpravo?: boolean;
  /** Doplňkové třídy buňky (šířka, zalamování). */
  trida?: string;
};

/**
 * Porovnání dvou hodnot jednoho sloupce.
 *
 * Prázdné hodnoty jdou VŽDYCKY nakonec, ať se řadí kterýmkoliv směrem -
 * jinak by po kliknutí byla půlka tabulky jen samé pomlčky. Texty se
 * porovnávají česky (Č za C, ne až za Z) a s ohledem na čísla uvnitř, aby
 * "Spot 2" předcházel "Spot 10".
 */
function porovnej(x: string | number | null, y: string | number | null, smer: SmerRazeni): number {
  const prazdneX = x === null || x === '';
  const prazdneY = y === null || y === '';
  if (prazdneX && prazdneY) return 0;
  if (prazdneX) return 1;
  if (prazdneY) return -1;

  const znamenko = smer === 'asc' ? 1 : -1;
  if (typeof x === 'number' && typeof y === 'number') return (x - y) * znamenko;
  return String(x).localeCompare(String(y), 'cs', { numeric: true }) * znamenko;
}

function Sipka({ smer }: { smer: SmerRazeni | null }) {
  if (!smer) {
    return (
      <span className="inline-block opacity-40 ml-1" aria-hidden="true">
        ↕
      </span>
    );
  }
  return (
    <span className="inline-block ml-1" aria-hidden="true">
      {smer === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export function RaditelnaTabulka<T>({
  radky,
  sloupce,
  klicRadku,
  vychoziSloupec,
  vychoziSmer = 'asc',
  prazdno,
  minSirka = 760,
  tridaRadku,
}: {
  radky: T[];
  sloupce: SloupecTabulky<T>[];
  klicRadku: (radek: T) => string;
  /** Podle čeho je tabulka seřazená hned po otevření. */
  vychoziSloupec?: string;
  vychoziSmer?: SmerRazeni;
  prazdno: string;
  minSirka?: number;
  tridaRadku?: (radek: T) => string;
}) {
  const [razeni, setRazeni] = useState<{ key: string; smer: SmerRazeni } | null>(
    vychoziSloupec ? { key: vychoziSloupec, smer: vychoziSmer } : null,
  );

  const serazene = useMemo(() => {
    if (!razeni) return radky;
    const sloupec = sloupce.find((s) => s.key === razeni.key);
    if (!sloupec?.hodnota) return radky;
    const ber = sloupec.hodnota;
    // Kopie, ne řazení na místě - vstupní pole patří volajícímu.
    return [...radky].sort((a, b) => porovnej(ber(a), ber(b), razeni.smer));
  }, [radky, sloupce, razeni]);

  function prepni(key: string) {
    setRazeni((soucasne) =>
      soucasne && soucasne.key === key
        ? { key, smer: soucasne.smer === 'asc' ? 'desc' : 'asc' }
        : { key, smer: 'asc' },
    );
  }

  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      {/* Sloupců bývá hodně a na užším okně se tabulka nevejde; posouvání do
          stran proto musí být vidět (zadání 8. 9. 2026). */}
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full border-collapse" style={{ minWidth: minSirka }}>
          <thead>
            <tr className="bg-bar text-white font-heading text-xs">
              {sloupce.map((sloupec) => {
                const aktivni = razeni?.key === sloupec.key;
                const zarovnani = sloupec.vpravo ? 'text-right' : 'text-left';
                if (!sloupec.hodnota) {
                  return (
                    <th key={sloupec.key} className={`${zarovnani} px-4 py-3.5 whitespace-nowrap`}>
                      {sloupec.label}
                    </th>
                  );
                }
                return (
                  <th
                    key={sloupec.key}
                    aria-sort={aktivni ? (razeni!.smer === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`${zarovnani} px-4 py-3.5 whitespace-nowrap`}
                  >
                    <button
                      type="button"
                      onClick={() => prepni(sloupec.key)}
                      title={`Seřadit podle: ${sloupec.label}`}
                      className={`font-heading text-xs hover:text-brand-purpleLight transition-colors ${
                        aktivni ? 'text-brand-purpleLight' : 'text-white'
                      }`}
                    >
                      {sloupec.label}
                      <Sipka smer={aktivni ? razeni!.smer : null} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {serazene.length === 0 && (
              <tr>
                <td
                  colSpan={sloupce.length}
                  className="px-4 py-8 text-center text-muted text-sm font-body"
                >
                  {prazdno}
                </td>
              </tr>
            )}
            {serazene.map((radek) => (
              <tr
                key={klicRadku(radek)}
                className={`border-t border-line hover:bg-surfaceSoft ${tridaRadku?.(radek) ?? ''}`}
              >
                {sloupce.map((sloupec) => (
                  <td
                    key={sloupec.key}
                    className={`px-4 py-3.5 text-sm font-heading ${sloupec.vpravo ? 'text-right' : ''} ${
                      sloupec.trida ?? ''
                    }`}
                  >
                    {sloupec.bunka(radek)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------------------
   Řazení pro tabulky, které mají vlastní podobu

   Ne každá tabulka se vejde do RaditelnaTabulka - třeba ceník má v řádcích
   rovnou vstupní pole. Aby ani ty nemusely řazení psát znovu, jsou tu jeho
   dvě části zvlášť: stav (useRazeni) a hlavička sloupce (ThRadit). Pravidla
   porovnávání jsou pořád tatáž, sdílená s komponentou výše.
--------------------------------------------------------------------------- */

export function useRazeni<T>(vychozi?: { key: string; smer?: SmerRazeni }) {
  const [razeni, setRazeni] = useState<{ key: string; smer: SmerRazeni } | null>(
    vychozi ? { key: vychozi.key, smer: vychozi.smer ?? 'asc' } : null,
  );

  function prepni(key: string) {
    setRazeni((soucasne) =>
      soucasne && soucasne.key === key
        ? { key, smer: soucasne.smer === 'asc' ? 'desc' : 'asc' }
        : { key, smer: 'asc' },
    );
  }

  /**
   * Seřadí řádky podle právě zvoleného sloupce. `hodnoty` říká, co se z řádku
   * pro který sloupec bere - stejně jako `hodnota` u sloupců výše.
   */
  function serad(radky: T[], hodnoty: Record<string, (radek: T) => string | number | null>): T[] {
    if (!razeni) return radky;
    const ber = hodnoty[razeni.key];
    if (!ber) return radky;
    return [...radky].sort((a, b) => porovnej(ber(a), ber(b), razeni.smer));
  }

  return { razeni, prepni, serad };
}

export function ThRadit({
  label,
  sloupec,
  razeni,
  prepni,
  vpravo,
  trida = '',
  title,
}: {
  label: string;
  sloupec: string;
  razeni: { key: string; smer: SmerRazeni } | null;
  prepni: (key: string) => void;
  vpravo?: boolean;
  trida?: string;
  title?: string;
}) {
  const aktivni = razeni?.key === sloupec;
  return (
    <th
      aria-sort={aktivni ? (razeni!.smer === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${vpravo ? 'text-right' : 'text-left'} px-4 py-3.5 whitespace-nowrap ${trida}`}
      title={title}
    >
      <button
        type="button"
        onClick={() => prepni(sloupec)}
        title={`Seřadit podle: ${label}`}
        className={`font-heading text-xs hover:text-brand-purpleLight transition-colors ${
          aktivni ? 'text-brand-purpleLight' : 'text-white'
        }`}
      >
        {label}
        <Sipka smer={aktivni ? razeni!.smer : null} />
      </button>
    </th>
  );
}
