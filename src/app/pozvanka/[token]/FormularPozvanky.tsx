'use client';

import { useState } from 'react';
import { DRUHY_PITI, type OdpovedNaPozvanku } from '@/lib/akce';

/**
 * DOTAZNÍK U POZVÁNKY (zadání 25. 11. 2026: „dotazník, zda někdo potřebuje
 * ubytování nebo ne" + „a kdo co pije").
 *
 * POPISKY JSOU PSANÉ TADY, ne přes lib/jazyk.ts: ten má rozdělanou práci
 * překladová dávka a dvě ruce v jednom souboru končí přepsanou prací.
 *
 * Odpověď jde změnit, dokud se akce nekoná - kdo si to rozmyslí, nemá
 * nikomu psát zvlášť.
 */
export function FormularPozvanky({
  token,
  jmeno,
  doKdy,
  uzOdpovedel,
  puvodni,
}: {
  token: string;
  jmeno: string;
  doKdy: string | null;
  uzOdpovedel: boolean;
  puvodni: OdpovedNaPozvanku;
}) {
  const [dorazi, setDorazi] = useState<boolean | null>(puvodni.dorazi);
  const [ubytovani, setUbytovani] = useState<boolean | null>(puvodni.ubytovani);
  const [piti, setPiti] = useState<string[]>(puvodni.piti ?? []);
  const [pitiText, setPitiText] = useState(puvodni.pitiText ?? '');
  const [poznamka, setPoznamka] = useState(puvodni.poznamka ?? '');
  const [uklada, setUklada] = useState(false);
  const [hotovo, setHotovo] = useState(uzOdpovedel);
  const [chyba, setChyba] = useState<string | null>(null);

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-sm font-body text-ink outline-none focus:border-brand-purple w-full';

  function prepniPiti(klic: string) {
    setPiti((p) => (p.includes(klic) ? p.filter((x) => x !== klic) : [...p, klic]));
  }

  async function odesli() {
    if (dorazi === null) {
      setChyba('Dejte nám prosím vědět, jestli dorazíte.');
      return;
    }
    if (dorazi && ubytovani === null) {
      setChyba('Ještě prosím ubytování - ano, nebo ne?');
      return;
    }
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/pozvanka/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dorazi,
          ubytovani: Boolean(ubytovani),
          piti,
          pitiText: pitiText.trim() || null,
          poznamka: poznamka.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba((data as { error?: string })?.error || 'Odpověď se nepodařilo uložit.');
        return;
      }
      setHotovo(true);
    } catch (err) {
      console.error('Odpoved na pozvanku se nepodarilo odeslat:', err);
      setChyba('Odpověď se nepodařilo uložit.');
    } finally {
      setUklada(false);
    }
  }

  const volba = (vybrano: boolean) =>
    `rounded-lg border px-4 py-2 text-sm font-heading font-semibold transition-colors ${
      vybrano
        ? 'border-brand-green bg-brand-green text-onAccent'
        : 'border-line bg-surface text-muted hover:border-brand-purple hover:text-brand-purple'
    }`;

  return (
    <div className="flex flex-col gap-5 border-t border-line pt-5">
      <div className="flex flex-col gap-2">
        <span className="font-heading font-semibold text-sm text-ink">
          {jmeno}, dorazíte?
        </span>
        {doKdy && (
          <span className="font-body text-xs text-muted">Odpovězte prosím do {doKdy}.</span>
        )}
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => setDorazi(true)} className={volba(dorazi === true)}>
            Dorazím
          </button>
          <button type="button" onClick={() => setDorazi(false)} className={volba(dorazi === false)}>
            Nedorazím
          </button>
        </div>
      </div>

      {/* Postel ani skleničku nikdo neřeší u toho, kdo nepřijede. */}
      {dorazi === true && (
        <>
          <div className="flex flex-col gap-2">
            <span className="font-heading font-semibold text-sm text-ink">
              Potřebujete přespat?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUbytovani(true)}
                className={volba(ubytovani === true)}
              >
                Ano, ubytování prosím
              </button>
              <button
                type="button"
                onClick={() => setUbytovani(false)}
                className={volba(ubytovani === false)}
              >
                Ne, odjedu
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-heading font-semibold text-sm text-ink">Co pijete?</span>
            <span className="font-body text-xs text-muted">
              Klidně víc možností - ať víme, co nakoupit.
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {DRUHY_PITI.map((d) => (
                <button
                  key={d.klic}
                  type="button"
                  onClick={() => prepniPiti(d.klic)}
                  className={`rounded-pill border px-3 py-1.5 text-sm font-heading font-semibold transition-colors ${
                    piti.includes(d.klic)
                      ? 'border-brand-green bg-brand-green text-onAccent'
                      : 'border-line bg-surface text-muted hover:border-brand-purple hover:text-brand-purple'
                  }`}
                >
                  {d.nazev}
                </button>
              ))}
            </div>
            <input
              value={pitiText}
              onChange={(e) => setPitiText(e.target.value)}
              placeholder="Upřesnění – třeba suché bílé nebo nealko pivo"
              className={`${pole} mt-1`}
            />
          </div>
        </>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-heading font-semibold text-sm text-ink">
          Chcete nám ještě něco vzkázat?
        </span>
        <textarea
          value={poznamka}
          onChange={(e) => setPoznamka(e.target.value)}
          rows={3}
          placeholder="Jídlo, alergie, kdy dorazíte, s kým přijedete…"
          className={pole}
        />
      </label>

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void odesli()}
          disabled={uklada}
          className="rounded-lg bg-brand-green text-onAccent font-heading font-semibold text-sm px-5 py-2.5 border-0 cursor-pointer disabled:opacity-60"
        >
          {uklada ? 'Ukládám…' : hotovo ? 'Upravit odpověď' : 'Odeslat odpověď'}
        </button>
        {hotovo && !uklada && (
          <span className="font-body text-sm text-brand-greenDeep">
            Díky, máme to. Změnit to můžete kdykoliv tímhle odkazem.
          </span>
        )}
      </div>
    </div>
  );
}
