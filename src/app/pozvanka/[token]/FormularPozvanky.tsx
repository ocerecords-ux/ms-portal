'use client';

import { useState } from 'react';
import { KLIC_DORAZI, otazkyPoDorazeni, type Odpovedi, type Otazka } from '@/lib/akce';

/**
 * DOTAZNÍK U POZVÁNKY (zadání 25. 11. 2026: „dotazník, zda někdo potřebuje
 * ubytování nebo ne", „a kdo co pije", „chci ty anketní otázky modifikovat
 * a přidávat nové").
 *
 * První otázka je vždycky „dorazíte?" - na ní stojí celý přehled. Zbytek
 * skládá pořadatel v administraci a tenhle formulář ho jen vykreslí podle
 * typu: dvě tlačítka, zaškrtávátka, nebo volné pole.
 *
 * POPISKY JSOU PSANÉ TADY, ne přes lib/jazyk.ts: ten má rozdělanou práci
 * překladová dávka a dvě ruce v jednom souboru končí přepsanou prací.
 */
export function FormularPozvanky({
  token,
  jmeno,
  doKdy,
  uzOdpovedel,
  otazky,
  puvodni,
  nahled = false,
}: {
  token: string;
  jmeno: string;
  doKdy: string | null;
  uzOdpovedel: boolean;
  otazky: Otazka[];
  puvodni: { dorazi: boolean | null; odpovedi: Odpovedi };
  /**
   * NÁHLED PRO POŘADATELE (25. 11. 2026: „chci i mít rovnou u toho anketu").
   * Tytéž otázky, jen se nic neodesílá - pořadatel si je proklikat může,
   * nikomu tím ale odpověď nezapíše.
   */
  nahled?: boolean;
}) {
  const [dorazi, setDorazi] = useState<boolean | null>(puvodni.dorazi);
  const [odpovedi, setOdpovedi] = useState<Odpovedi>(puvodni.odpovedi ?? {});
  const [uklada, setUklada] = useState(false);
  const [hotovo, setHotovo] = useState(uzOdpovedel);
  const [chyba, setChyba] = useState<string | null>(null);

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-sm font-body text-ink outline-none focus:border-brand-purple w-full';

  function nastav(id: string, hodnota: boolean | string[] | string) {
    setOdpovedi((o) => ({ ...o, [id]: hodnota }));
  }

  function prepniMoznost(o: Otazka, moznost: string) {
    const ted = Array.isArray(odpovedi[o.id]) ? (odpovedi[o.id] as string[]) : [];
    if (o.vicMoznosti === false) {
      nastav(o.id, ted.includes(moznost) ? [] : [moznost]);
      return;
    }
    nastav(o.id, ted.includes(moznost) ? ted.filter((m) => m !== moznost) : [...ted, moznost]);
  }

  async function odesli() {
    // V náhledu se nikam nic neposílá - viz prop `nahled`.
    if (nahled) return;
    if (dorazi === null) {
      setChyba('Dejte nám prosím vědět, jestli dorazíte.');
      return;
    }
    setUklada(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/pozvanka/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dorazi, odpovedi }),
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

  /** Základní otázka - text i popisky tlačítek si pořadatel přepsal sám. */
  const zakladni = otazky.find((o) => o.id === KLIC_DORAZI);

  return (
    <div className="flex flex-col gap-5 border-t border-line pt-5">
      <div className="flex flex-col gap-2">
        {/* BEZ OSLOVENI (25. 11. 2026: "v otazce Dorazite by nemelo uz byt
            osloveni"). Jmeno stoji v hlavicce stranky, v otazce prekazelo. */}
        <span className="font-heading font-semibold text-sm text-ink">
          {zakladni?.text ?? 'Dorazíte?'}
        </span>
        {zakladni?.napoveda && (
          <span className="font-body text-xs text-muted">{zakladni.napoveda}</span>
        )}
        {doKdy && <span className="font-body text-xs text-muted">Odpovězte prosím do {doKdy}.</span>}
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => setDorazi(true)} className={volba(dorazi === true)}>
            {zakladni?.ano || 'Dorazím'}
          </button>
          <button type="button" onClick={() => setDorazi(false)} className={volba(dorazi === false)}>
            {zakladni?.ne || 'Nedorazím'}
          </button>
        </div>
      </div>

      {/*
        CELA ANKETA NA JEDNE STRANCE (25. 11. 2026: "ta anketa musi byt na
        jedne strance, kdyz se prokliknu z mailu").
        Otazky se drive odkryly az po klepnuti na "Dorazim" a pusobilo to jako
        kroky, kterymi se musi projit. Ted jsou videt vsechny rovnou - clovek
        vi, co ho ceka, a vyplni to odshora dolu. Schovaji se jen tomu, kdo
        rekne, ze nedorazi; tam uz nema co vyplnovat.
      */}
      {dorazi !== false &&
        otazkyPoDorazeni(otazky).map((o) => (
          <div key={o.id} className="flex flex-col gap-2">
            <span className="font-heading font-semibold text-sm text-ink">{o.text}</span>
            {o.napoveda && <span className="font-body text-xs text-muted">{o.napoveda}</span>}

            {o.typ === 'ANO_NE' && (
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => nastav(o.id, true)}
                  className={volba(odpovedi[o.id] === true)}
                >
                  {o.ano || 'Ano'}
                </button>
                <button
                  type="button"
                  onClick={() => nastav(o.id, false)}
                  className={volba(odpovedi[o.id] === false)}
                >
                  {o.ne || 'Ne'}
                </button>
              </div>
            )}

            {o.typ === 'VYBER' && (
              <div className="flex flex-wrap gap-2 mt-1">
                {/* Rozepsaná prázdná možnost z editoru se nekreslí. */}
                {(o.moznosti ?? []).filter(Boolean).map((m) => {
                  const vybrano = Array.isArray(odpovedi[o.id]) && (odpovedi[o.id] as string[]).includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => prepniMoznost(o, m)}
                      className={`rounded-pill border px-3 py-1.5 text-sm font-heading font-semibold transition-colors ${
                        vybrano
                          ? 'border-brand-green bg-brand-green text-onAccent'
                          : 'border-line bg-surface text-muted hover:border-brand-purple hover:text-brand-purple'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {o.typ === 'TEXT' && (
              <textarea
                value={typeof odpovedi[o.id] === 'string' ? (odpovedi[o.id] as string) : ''}
                onChange={(e) => nastav(o.id, e.target.value)}
                rows={3}
                className={pole}
              />
            )}
          </div>
        ))}

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void odesli()}
          disabled={uklada || nahled}
          className="rounded-lg bg-brand-green text-onAccent font-heading font-semibold text-sm px-5 py-2.5 border-0 cursor-pointer disabled:opacity-60"
        >
          {uklada ? 'Ukládám…' : hotovo ? 'Upravit odpověď' : 'Odeslat odpověď'}
        </button>
        {nahled && (
          <span className="font-body text-xs text-muted">
            Náhled - takhle to uvidí pozvaný. Odsud se nic neodesílá.
          </span>
        )}
        {hotovo && !uklada && !nahled && (
          <span className="font-body text-sm text-brand-greenDeep">
            Díky, máme to. Změnit to můžete kdykoliv tímhle odkazem.
          </span>
        )}
      </div>
    </div>
  );
}
