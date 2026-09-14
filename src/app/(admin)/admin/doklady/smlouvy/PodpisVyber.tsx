'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SignaturePad } from './SignaturePad';

/**
 * DVA DRUHY PODPISU (zadání 13. 9. 2026: „dal bych na výběr dva druhy
 * podpisu. Buď to vytvoří nějaký přednastavený ze jména, nebo ho nakreslíš").
 *
 * Kreslení myší je na počítači nepříjemné a výsledek vypadá jako klikyhák —
 * u smlouvy, kterou si někdo otevře na notebooku, je psaný podpis ze jména
 * čitelnější a důstojnější. Prstem na mobilu naopak kreslení dává smysl,
 * proto zůstávají obě cesty.
 *
 * OBĚ VARIANTY VRACEJÍ TOTÉŽ: PNG v data URL. Nic za tímhle komponentem
 * (uložení, ContractPaper, PDF) proto o dvou druzích podpisu neví a nemuselo
 * se kvůli tomu nic měnit — ani databáze.
 *
 * PRÁVNĚ SE TÍM NIC NEMĚNÍ. Důkazem není podoba čáry, ale to, co se ukládá
 * vedle ní: čas, IP adresa a otisk podepsaného textu. Psaný podpis je proto
 * rovnocenný, ne slabší — a u papírových smluv se ostatně taky nikdo
 * nepodepisuje dvakrát stejně.
 */

/** Písmo pro psaný podpis - musí sedět s rodinou `podpis` v tailwind.config. */
const TRIDA_PISMA = 'font-podpis';

export function PodpisVyber({
  onChange,
  jmeno,
  disabled,
}: {
  onChange: (dataUrl: string | null) => void;
  /** Jméno podepisujícího - z něj se skládá psaný podpis. */
  jmeno: string;
  disabled?: boolean;
}) {
  const [rezim, setRezim] = useState<'psany' | 'kresleny'>('psany');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mericiRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Vykreslí jméno na plátno a vrátí PNG.
   *
   * Rodina písma se čte z DOMu, ne píše natvrdo: next/font si název generuje
   * sám (`__Caveat_1a2b3c`) a do `ctx.font` se musí dostat ten skutečný.
   * Proto ten neviditelný `<span>` s toutéž třídou.
   *
   * Na písmo se čeká přes `document.fonts.load` - bez toho by první vykreslení
   * padlo do náhradního písma a podpis by vypadal jako obyčejný text.
   */
  const vykresli = useCallback(async () => {
    const canvas = canvasRef.current;
    const merici = mericiRef.current;
    const text = jmeno.trim();
    if (!canvas || !merici) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = window.devicePixelRatio || 1;
    const sirka = canvas.parentElement?.clientWidth ?? 480;
    const vyska = 120;
    canvas.width = Math.round(sirka * scale);
    canvas.height = Math.round(vyska * scale);
    canvas.style.width = `${sirka}px`;
    canvas.style.height = `${vyska}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, sirka, vyska);

    if (!text) {
      onChange(null);
      return;
    }

    const rodina = getComputedStyle(merici).fontFamily;
    let velikost = 54;
    try {
      await document.fonts.load(`${velikost}px ${rodina}`, text);
    } catch {
      // Kdyz se pismo nenacte, kresli se zalozni rukopisnou rodinou.
    }

    // Dlouhe jmeno se zmensi, at se vejde - useknuty podpis je horsi nez maly.
    ctx.textBaseline = 'middle';
    for (; velikost > 22; velikost -= 2) {
      ctx.font = `${velikost}px ${rodina}`;
      if (ctx.measureText(text).width <= sirka - 48) break;
    }

    // Tmavy inkoust na pruhledne platno - stejne jako u kresleneho podpisu,
    // aby se obe varianty chovaly v PDF a v ContractPaper identicky.
    ctx.fillStyle = '#201A33';
    ctx.fillText(text, 24, vyska / 2);
    onChange(canvas.toDataURL('image/png'));
  }, [jmeno, onChange]);

  useEffect(() => {
    if (rezim !== 'psany') return;
    void vykresli();
  }, [rezim, vykresli]);

  // Prepnuti rezimu zahazuje predchozi podpis: jinak by po prepnuti zustal
  // viset podpis z druhe varianty, ktery uz clovek nevidi.
  function prepni(novy: 'psany' | 'kresleny') {
    if (novy === rezim) return;
    onChange(null);
    setRezim(novy);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Meric rodiny pisma - viz poznamka u vykresli(). */}
      <span ref={mericiRef} className={`${TRIDA_PISMA} absolute opacity-0 pointer-events-none`} aria-hidden="true">
        .
      </span>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Prepinac aktivni={rezim === 'psany'} onClick={() => prepni('psany')} disabled={disabled}>
          Podepsat jménem
        </Prepinac>
        <Prepinac aktivni={rezim === 'kresleny'} onClick={() => prepni('kresleny')} disabled={disabled}>
          Nakreslit podpis
        </Prepinac>
      </div>

      {rezim === 'psany' ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-card border-2 border-dashed border-line bg-white overflow-hidden">
            <canvas ref={canvasRef} className="block" />
          </div>
          <span className="text-xs font-body text-muted">
            {jmeno.trim()
              ? 'Podpis se vytvoří z vašeho jména výš. Když jméno upravíte, podpis se přepíše.'
              : 'Vyplňte výš své jméno — podpis se z něj vytvoří sám.'}
          </span>
        </div>
      ) : (
        <SignaturePad onChange={onChange} disabled={disabled} />
      )}
    </div>
  );
}

function Prepinac({
  aktivni,
  onClick,
  disabled,
  children,
}: {
  aktivni: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={aktivni}
      className={`rounded-pill px-3.5 py-1.5 text-xs font-heading font-semibold border transition-colors disabled:opacity-50 ${
        aktivni
          ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
          : 'border-line text-muted hover:text-ink hover:border-brand-purple/40'
      }`}
    >
      {children}
    </button>
  );
}
