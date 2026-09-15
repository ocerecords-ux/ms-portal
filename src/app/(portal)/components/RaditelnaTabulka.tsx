'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

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

/**
 * HLEDÁNÍ A FILTRY NAD TABULKOU (zadání 15. 9. 2026: „tady to chce přidat
 * hledání a detailnější filtry").
 *
 * Je to schválně tady, ne v každé tabulce zvlášť: jakmile to umí společná
 * tabulka, chová se hledání ve Fakturách, Výdajích, Nabídkách i Smlouvách
 * stejně a nové tabulky to dostanou zadarmo.
 */
export type FiltrTabulky<T> = {
  key: string;
  label: string;
  moznosti: { hodnota: string; popisek: string }[];
  /** Vyhovuje řádek vybrané hodnotě? Prázdná hodnota znamená „nefiltrovat". */
  vyhovuje: (radek: T, hodnota: string) => boolean;
};

/** Filtr „od - do" nad jedním datem (vystaveno, splatnost, ...). */
export type RozsahDatumu<T> = {
  label: string;
  ms: (radek: T) => number | null;
};

/** Porovnávací tvar - bez diakritiky, malými písmeny. */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Nabídka do filtru - unikátní hodnoty sloupce, česky seřazené. */
export function moznostiZ<T>(radky: T[], ber: (radek: T) => string | null | undefined) {
  const hodnoty = [...new Set(radky.map((r) => ber(r)?.trim()).filter((h): h is string => Boolean(h)))];
  hodnoty.sort((a, b) => a.localeCompare(b, 'cs', { numeric: true }));
  return hodnoty.map((h) => ({ hodnota: h, popisek: h }));
}

function Lupa() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-muted" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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
  hledat,
  hledatPlaceholder = 'Hledat…',
  filtry,
  rozsahDatumu,
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
  /** Text řádku, ve kterém se hledá. Bez něj se hledací pole neukáže. */
  hledat?: (radek: T) => string;
  hledatPlaceholder?: string;
  filtry?: FiltrTabulky<T>[];
  rozsahDatumu?: RozsahDatumu<T>;
}) {
  const [razeni, setRazeni] = useState<{ key: string; smer: SmerRazeni } | null>(
    vychoziSloupec ? { key: vychoziSloupec, smer: vychoziSmer } : null,
  );

  const [dotaz, setDotaz] = useState('');
  const [volby, setVolby] = useState<Record<string, string>>({});
  const [od, setOd] = useState('');
  const [doKdy, setDoKdy] = useState('');

  const maListu = Boolean(hledat || (filtry && filtry.length > 0) || rozsahDatumu);
  const neco = Boolean(dotaz.trim() || od || doKdy || Object.values(volby).some(Boolean));

  const filtrovane = useMemo(() => {
    let vysledek = radky;

    if (hledat && dotaz.trim()) {
      // Hledá se po slovech nezávisle na pořadí a bez diakritiky - stejně
      // jako ve výběrových polích s lupou.
      const slova = zjednodus(dotaz).split(/\s+/).filter(Boolean);
      vysledek = vysledek.filter((r) => {
        const seno = zjednodus(hledat(r));
        return slova.every((slovo) => seno.includes(slovo));
      });
    }

    for (const filtr of filtry ?? []) {
      const hodnota = volby[filtr.key];
      if (hodnota) vysledek = vysledek.filter((r) => filtr.vyhovuje(r, hodnota));
    }

    if (rozsahDatumu && (od || doKdy)) {
      const odMs = od ? new Date(`${od}T00:00:00`).getTime() : null;
      const doMs = doKdy ? new Date(`${doKdy}T23:59:59`).getTime() : null;
      vysledek = vysledek.filter((r) => {
        const ms = rozsahDatumu.ms(r);
        if (ms == null) return false;
        if (odMs != null && ms < odMs) return false;
        if (doMs != null && ms > doMs) return false;
        return true;
      });
    }

    return vysledek;
  }, [radky, hledat, dotaz, filtry, volby, rozsahDatumu, od, doKdy]);

  const serazene = useMemo(() => {
    const radky = filtrovane;
    if (!razeni) return radky;
    const sloupec = sloupce.find((s) => s.key === razeni.key);
    if (!sloupec?.hodnota) return radky;
    const ber = sloupec.hodnota;
    // Kopie, ne řazení na místě - vstupní pole patří volajícímu.
    return [...radky].sort((a, b) => porovnej(ber(a), ber(b), razeni.smer));
  }, [filtrovane, sloupce, razeni]);

  function prepni(key: string) {
    setRazeni((soucasne) =>
      soucasne && soucasne.key === key
        ? { key, smer: soucasne.smer === 'asc' ? 'desc' : 'asc' }
        : { key, smer: 'asc' },
    );
  }

  const poleTridy =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple';

  return (
    <div className="flex flex-col gap-3">
      {maListu && (
        <div className="bg-surface rounded-card border border-line shadow-sm px-4 py-3 flex flex-wrap items-center gap-2">
          {hledat && (
            <label className={`${poleTridy} flex items-center gap-2 flex-1 min-w-[220px] py-0`}>
              <Lupa />
              <input
                value={dotaz}
                onChange={(e) => setDotaz(e.target.value)}
                placeholder={hledatPlaceholder}
                className="bg-transparent outline-none border-0 py-2 w-full text-ink font-heading text-sm"
              />
              {dotaz && (
                <button
                  type="button"
                  onClick={() => setDotaz('')}
                  title="Vymazat hledání"
                  className="text-muted hover:text-ink text-sm leading-none px-1"
                >
                  ×
                </button>
              )}
            </label>
          )}

          {(filtry ?? []).map((filtr) => (
            <VyberPole
              key={filtr.key}
              value={volby[filtr.key] ?? ''}
              onChange={(e) => setVolby((s) => ({ ...s, [filtr.key]: e.target.value }))}
              className={`${poleTridy} min-w-[170px]`}
            >
              <option value="">{filtr.label}: vše</option>
              {filtr.moznosti.map((m) => (
                <option key={m.hodnota} value={m.hodnota}>
                  {m.popisek}
                </option>
              ))}
            </VyberPole>
          ))}

          {rozsahDatumu && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-body text-muted whitespace-nowrap">{rozsahDatumu.label} od</span>
              <DatumPole value={od} onChange={(e) => setOd(e.target.value)} className={poleTridy} />
              <span className="text-xs font-body text-muted">do</span>
              <DatumPole value={doKdy} onChange={(e) => setDoKdy(e.target.value)} className={poleTridy} />
            </span>
          )}

          {neco && (
            <>
              <span className="text-xs font-body text-muted tabular-nums">
                {serazene.length} z {radky.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDotaz('');
                  setVolby({});
                  setOd('');
                  setDoKdy('');
                }}
                className="text-sm font-heading text-brand-purple hover:underline"
              >
                Zrušit filtry
              </button>
            </>
          )}
        </div>
      )}

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
  naFialovem = false,
}: {
  label: string;
  sloupec: string;
  razeni: { key: string; smer: SmerRazeni } | null;
  prepni: (key: string) => void;
  vpravo?: boolean;
  trida?: string;
  title?: string;
  /**
   * Sedí hlavička na fialovém pruhu? Pak se seřazený sloupec zvýrazní zeleně -
   * světle fialová by na fialovém podkladu nebyla vidět. Na tmavém pruhu
   * (výchozí stav) se zvýrazňuje světle fialovou.
   */
  naFialovem?: boolean;
}) {
  const aktivni = razeni?.key === sloupec;
  // Třídy se schválně skládají z celých názvů, ne z kousků - Tailwind hledá
  // ve zdrojácích přesné řetězce a poskládaný název by mu utekl.
  const barvy = naFialovem
    ? `hover:text-brand-green ${aktivni ? 'text-brand-green' : 'text-white'}`
    : `hover:text-brand-purpleLight ${aktivni ? 'text-brand-purpleLight' : 'text-white'}`;
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
        className={`font-heading text-xs transition-colors ${barvy}`}
      >
        {label}
        <Sipka smer={aktivni ? razeni!.smer : null} />
      </button>
    </th>
  );
}
