'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BublinaHerce, type Herec } from './VyberHerce';
import { TRIDA_SLOUPCE_HERCU } from '@/lib/bublinaHerce';

/**
 * Výběr VÍCE herců k projektu (zadání 10. 9. 2026: „ještě nemám v detailu
 * projektu, když vkládám herce, mnohonásobný výběr — chci jich tam dát více").
 *
 * Víc lidí na jednu knihu je běžné: dabing, dvojhlas, vypravěč plus postavy.
 * Do té doby šel u projektu vyplnit jen jeden.
 *
 * HERCI JSOU ČÍSLOVANÍ - Herec 1, Herec 2, ... (zadání 10. 9. 2026:
 * „nelíbí se mi u herců označení hlavní, dal bych Herec 1, Herec 2").
 * Na pořadí záleží: podle prvního se předvyplňuje natáčecí frekvence,
 * a proto jde s bublinami hýbat - šipkou se herec posune dopředu.
 *
 * Vybraný herec se v nabídce už neukazuje: dvakrát tentýž herec u jednoho
 * projektu nedává smysl a databáze by to stejně odmítla.
 */

/** Porovnávací tvar - bez diakritiky, malá písmena. „cerny" najde „Černý". */
function zjednodus(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function VyberHercu({
  herci,
  hodnoty,
  onZmena,
  puvodniText,
  disabled,
  dotoceni,
  onPrepnoutDotoceno,
  onPoslatKlientovi,
  dotoceniBezi,
  strany,
  normostrany,
  onZmenitNormostrany,
}: {
  herci: Herec[];
  /** ID vybraných účtů v pořadí - první je Herec 1. */
  hodnoty: string[];
  onZmena: (ids: string[]) => void;
  /** Jméno herce, jak přišlo z Caflou - vodítko, dokud účet přiřazený není. */
  puvodniText?: string | null;
  disabled?: boolean;
  /**
   * Kdo z herců má dotočeno - ID účtu -> datum (zadání 11. 9. 2026).
   * Ukládá se zvlášť od zbytku formuláře: je to událost, ne vlastnost, kterou
   * by měl člověk „rozepsanou" a potvrzoval ji až spolu s ostatním.
   */
  dotoceni?: Record<string, string>;
  onPrepnoutDotoceno?: (userId: string, dotoceno: boolean) => void;
  /**
   * Poslat klientovi znovu zprávu o dotočení (zadání 16. 9. 2026). Ukazuje se
   * jen u herce, který dotočeno UŽ MÁ — jinde by to nemělo co poslat.
   */
  onPoslatKlientovi?: (userId: string) => void;
  /** ID herce, u kterého se zrovna ukládá - tlačítko na něj chvíli nereaguje. */
  dotoceniBezi?: string | null;
  /**
   * Poslední strana z natáčecího protokolu - ID účtu -> strana. Jen se
   * zobrazuje jako odznak na bublině; výběr herců s ní nic nedělá.
   */
  strany?: Record<string, number>;
  /**
   * NORMOSTRANY JEDNOHO HERCE (zadání 23. 9. 2026: „v případě, že bude více
   * jak jeden herec u projektu, tak bych potřeboval mít u nich možnost přidat
   * ke každému počet normostran, kvůli plánování"). ID účtu -> normostrany.
   * Políčko se ukazuje, až když jsou herci aspoň dva - u jednoho je rozsah
   * celého projektu a druhé číslo by jen mátlo.
   */
  normostrany?: Record<string, number>;
  onZmenitNormostrany?: (userId: string, pageCount: number | null) => void;
}) {
  const [hledani, setHledani] = useState('');
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLDivElement>(null);

  // Nabídku zavírá klik MIMO ni, ne opuštění políčka.
  //
  // Původně se zavírala na onBlur se zpožděním 120 ms — jenže blur přijde
  // hned při zmáčknutí tlačítka myši, zatímco klik až při puštění. Kdo
  // klikl pomaleji než za 120 ms (což při vybírání ze seznamu dělá skoro
  // každý), stihla se nabídka zavřít dřív, tlačítko zmizelo a herec se
  // nepřidal. Stejně to řeší i výběr jednoho herce ve VyberHerce.
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  const vybrani = useMemo(
    () => hodnoty.map((id) => herci.find((h) => h.id === id)).filter((h): h is Herec => Boolean(h)),
    [herci, hodnoty],
  );

  const nalezeni = useMemo(() => {
    const dotaz = zjednodus(hledani);
    const zbyva = herci.filter((h) => !hodnoty.includes(h.id));
    if (!dotaz) return zbyva;
    return zbyva.filter((h) => zjednodus(h.label).includes(dotaz));
  }, [herci, hodnoty, hledani]);

  function pridej(id: string) {
    onZmena([...hodnoty, id]);
    setHledani('');
    setOtevreno(false);
  }

  function odeber(id: string) {
    onZmena(hodnoty.filter((h) => h !== id));
  }

  /** Posun o jedno místo dopředu - z Herce 3 se stane Herec 2. */
  function nahoru(id: string) {
    const i = hodnoty.indexOf(id);
    if (i <= 0) return;
    const nove = [...hodnoty];
    [nove[i - 1], nove[i]] = [nove[i], nove[i - 1]];
    onZmena(nove);
  }

  /**
   * OKNO S AKCEMI U HERCE (zadání 26. 9. 2026: „pojďme všechna ta funkční
   * tlačítka přesunout až do vyskakovacího okna po kliknutí").
   *
   * V seznamu tak zůstanou jen jména - a o to jde: z detailu projektu se
   * nejčastěji potřebuje vědět, KDO na zakázce je. Dotočeno, zpráva klientovi,
   * pořadí, normostrany i odebrání jsou úkony, které se dělají výjimečně,
   * takže patří o klepnutí dál.
   *
   * Okno se kotví k bublině (fixed podle getBoundingClientRect), nic
   * nezamlžuje a zavírá se klepnutím mimo, Escapem nebo posunem stránky -
   * stejně jako náhledy u ikon v přehledu projektů.
   */
  const [akce, setAkce] = useState<{ id: string; left: number; top: number } | null>(null);
  const oknoRef = useRef<HTMLDivElement>(null);

  function otevriAkce(id: string, prvek: HTMLElement) {
    const r = prvek.getBoundingClientRect();
    setAkce({
      id,
      left: Math.min(r.left, window.innerWidth - SIRKA_OKNA - 8),
      top: r.bottom + 6,
    });
  }

  /** Okno se nesmí schovat pod spodní hranou - když se nevejde, jde nad bublinu. */
  useLayoutEffect(() => {
    if (!akce || !oknoRef.current) return;
    const r = oknoRef.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const novyVrsek = Math.max(8, window.innerHeight - r.height - 8);
      if (Math.abs(novyVrsek - akce.top) > 1) setAkce({ ...akce, top: novyVrsek });
    }
  }, [akce]);

  useEffect(() => {
    if (!akce) return;
    const zavri = () => setAkce(null);
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAkce(null);
    };
    const mimo = (e: MouseEvent) => {
      if (oknoRef.current && !oknoRef.current.contains(e.target as Node)) setAkce(null);
    };
    window.addEventListener('keydown', klavesa);
    window.addEventListener('scroll', zavri, true);
    window.addEventListener('resize', zavri);
    // Až v dalším cyklu, ať otevírací klik okno rovnou nezavře.
    const t = window.setTimeout(() => document.addEventListener('mousedown', mimo), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('scroll', zavri, true);
      window.removeEventListener('resize', zavri);
      document.removeEventListener('mousedown', mimo);
    };
  }, [akce]);

  const otevrenyIndex = akce ? hodnoty.indexOf(akce.id) : -1;
  const otevrenyHerec = akce ? vybrani.find((h) => h.id === akce.id) ?? null : null;
  const otevrenyDotoceno = akce ? dotoceni?.[akce.id] : undefined;

  return (
    <div ref={obal} className="flex flex-col gap-2">
      {vybrani.length > 0 && (
        <div className={TRIDA_SLOUPCE_HERCU}>
          {vybrani.map((h, i) => (
            <span key={h.id} className="inline-flex items-center gap-2">
              <span className="text-[11px] font-heading text-muted w-[52px] shrink-0">Herec {i + 1}</span>
              <BublinaHerce
                jmeno={h.label}
                disabled={disabled}
                dotoceno={dotoceni?.[h.id]}
                strana={strany?.[h.id]}
                popisek="Klepnutím otevřete, co se s hercem dá udělat"
                // Klepnutí na jméno otevře okno s akcemi (26. 9. 2026);
                // křížek u bubliny není, odebrání je taky v okně.
                onZmenit={(prvek) => otevriAkce(h.id, prvek)}
              />
              {/* Že je dotočeno, říká zelená linka kolem jména - žádné
                  tlačítko vedle. Všechno ostatní je v okně. */}
            </span>
          ))}
        </div>
      )}

      {/* OKNO S AKCEMI. Nic nezamlžuje, zavírá se klikem mimo nebo Escapem. */}
      {akce && otevrenyHerec && (
        <div
          ref={oknoRef}
          style={{ position: 'fixed', left: akce.left, top: akce.top, width: SIRKA_OKNA }}
          className="z-[90] flex flex-col gap-1 rounded-card border border-line bg-surface shadow-2xl p-2 text-left"
        >
          <span className="px-2 pt-1 pb-1.5 border-b border-line flex flex-col gap-0.5">
            <span className="font-heading font-semibold text-sm text-ink truncate">
              {otevrenyHerec.label}
            </span>
            <span className="text-[11px] font-body text-muted">
              {otevrenyDotoceno
                ? `Dotočeno ${new Date(otevrenyDotoceno).toLocaleDateString('cs-CZ')}`
                : `Herec ${otevrenyIndex + 1}`}
            </span>
          </span>

          {onPrepnoutDotoceno && (
            <PolozkaOkna
              disabled={disabled || dotoceniBezi === akce.id}
              onClick={() => onPrepnoutDotoceno(akce.id, !otevrenyDotoceno)}
            >
              {dotoceniBezi === akce.id
                ? 'Ukládám…'
                : otevrenyDotoceno
                  ? 'Zrušit dotočeno'
                  : 'Označit dotočeno'}
            </PolozkaOkna>
          )}

          {/* POSLAT KLIENTOVI ZNOVU (zadání 16. 9. 2026). Klientovi se
              dotočení oznamuje jen jednou, v okamžiku, kdy vznikne - když si
              upozornění zapnul až potom, jde zpráva poslat odsud. Nic se tím
              nepřepisuje, jen odejde mail a zvoneček. */}
          {onPoslatKlientovi && otevrenyDotoceno && (
            <PolozkaOkna
              disabled={disabled || dotoceniBezi === akce.id}
              onClick={() => onPoslatKlientovi(akce.id)}
            >
              Poslat klientovi znovu
            </PolozkaOkna>
          )}

          {/* Normostrany herce (23. 9. 2026) - jen u víc herců naráz; u reklamy
              je volající vůbec nepředá. */}
          {onZmenitNormostrany && vybrani.length > 1 && (
            <label className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm font-body text-ink">
              Normostrany
              <input
                type="number"
                min={0}
                disabled={disabled}
                defaultValue={normostrany?.[akce.id] ?? ''}
                onBlur={(e) => {
                  const hodnota = e.target.value.trim();
                  const cislo = hodnota === '' ? null : Number(hodnota);
                  if (cislo !== null && (!Number.isFinite(cislo) || cislo < 0)) return;
                  const puvodni = normostrany?.[akce.id] ?? null;
                  if ((cislo ?? null) === puvodni) return;
                  onZmenitNormostrany(akce.id, cislo);
                }}
                placeholder="0"
                title="Normostrany tohoto herce - podle nich se plánují jeho frekvence"
                className="w-20 rounded-lg border border-line bg-field px-2 py-1 text-ink font-heading text-xs tabular-nums outline-none focus:border-brand-purple disabled:opacity-50"
              />
            </label>
          )}

          {otevrenyIndex > 0 && (
            <PolozkaOkna
              disabled={disabled}
              onClick={() => {
                nahoru(akce.id);
                setAkce(null);
              }}
            >
              Posunout výš (na Herce {otevrenyIndex})
            </PolozkaOkna>
          )}

          <PolozkaOkna
            disabled={disabled}
            nebezpecna
            onClick={() => {
              odeber(akce.id);
              setAkce(null);
            }}
          >
            Odebrat z projektu
          </PolozkaOkna>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={hledani}
          onChange={(e) => {
            setHledani(e.target.value);
            setOtevreno(true);
          }}
          onFocus={() => setOtevreno(true)}
          placeholder={
            vybrani.length > 0
              ? 'přidat dalšího herce'
              : puvodniText
                ? `hledat herce (v Caflou: ${puvodniText})`
                : 'začněte psát jméno herce'
          }
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full"
        />

        {otevreno && (
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
            {nalezeni.length === 0 ? (
              <p className="px-3 py-2.5 text-sm font-body text-muted m-0">
                {herci.length === 0
                  ? 'V portálu zatím není žádný herec — nejdřív ho založte mezi uživateli.'
                  : hodnoty.length === herci.length
                    ? 'Všichni herci už jsou u projektu.'
                    : 'Nikdo takový tu není.'}
              </p>
            ) : (
              nalezeni.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => pridej(h.id)}
                  className="block w-full text-left px-3 py-2 text-sm font-heading text-ink hover:bg-tint transition-colors"
                >
                  {h.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Šířka okna s akcemi; drží se i při počítání, aby nevylezlo z obrazovky. */
const SIRKA_OKNA = 230;

/** Řádek v okně s akcemi - ať vypadají všechny stejně. */
function PolozkaOkna({
  children,
  onClick,
  disabled,
  nebezpecna,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Odebrání se odliší barvou, ať se neklepne omylem. */
  nebezpecna?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-lg text-sm font-heading bg-transparent border-0 cursor-pointer transition-colors disabled:opacity-50 ${
        nebezpecna ? 'text-muted hover:text-status-error hover:bg-field' : 'text-ink hover:bg-field'
      }`}
    >
      {children}
    </button>
  );
}
