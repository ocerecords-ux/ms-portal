'use client';

import { useState } from 'react';

/**
 * NÁHLED PŘÍLOHY VEDLE DOKLADU (zadání 16. 9. 2026: „tady u výdajů bych
 * potřeboval, ať se mi na pravé straně obrazovky zobrazí rovnou náhled té
 * přílohy").
 *
 * Do teď u přílohy svítil jen odkaz „Otevřít". Účtenku ale člověk potřebuje
 * vidět PŘI vyplňování — částku, datum a dodavatele z ní opisuje — a otevírat
 * ji na druhé záložce znamená přepínat tam a zpět u každého políčka.
 *
 * Soubor se bere přes /api/admin/expenses/[id]/priloha, ne z úložiště přímo:
 * adresa v R2 je rozhraní úložiště a bez podpisu vrátí chybu. Portál odkaz
 * podepíše sám a pokaždé ověří, že se dívá Žůžo-labůžo.
 */
export function NahledPrilohy({
  expenseId,
  nazev,
}: {
  expenseId: string;
  /** Název souboru — podle přípony se pozná, čím se dá vykreslit. */
  nazev: string | null;
}) {
  const [chyba, setChyba] = useState(false);
  const odkaz = `/api/admin/expenses/${encodeURIComponent(expenseId)}/priloha`;
  const druh = druhSouboru(nazev);

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">Příloha</span>
        <span className="flex items-center gap-3">
          <a
            href={odkaz}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-heading text-brand-purple no-underline"
          >
            Otevřít
          </a>
          <a
            href={`${odkaz}?stahnout=1`}
            className="text-xs font-heading text-muted hover:text-ink no-underline"
          >
            Stáhnout
          </a>
        </span>
      </div>

      {/* Světlý podklad schválně i v tmavém režimu: účtenky a faktury jsou
          bílé papíry a na tmavém pozadí kolem nich svítí ostrý rám. */}
      <div className="bg-white min-h-[420px] flex items-center justify-center">
        {chyba || druh === 'jine' ? (
          <p className="text-sm font-body text-muted m-0 px-6 py-10 text-center">
            {chyba
              ? 'Náhled se nepodařilo načíst.'
              : 'Tenhle typ souboru se v prohlížeči nezobrazí.'}
            <br />
            <a href={odkaz} target="_blank" rel="noreferrer" className="text-brand-purple">
              Otevřít v novém okně
            </a>
          </p>
        ) : druh === 'obrazek' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={odkaz}
            alt={nazev || 'Příloha dokladu'}
            onError={() => setChyba(true)}
            className="max-w-full h-auto"
          />
        ) : (
          /* PDF si vykreslí prohlížeč sám. #toolbar=0 schová jeho vlastní
             lištu — tlačítka Otevřít a Stáhnout jsou o kus výš. */
          <iframe
            src={`${odkaz}#toolbar=0&navpanes=0`}
            title={nazev || 'Příloha dokladu'}
            className="w-full h-[70vh] min-h-[420px] border-0"
          />
        )}
      </div>

      {nazev && (
        <p className="text-xs font-body text-muted m-0 px-4 py-2 border-t border-line break-all">
          {nazev}
        </p>
      )}
    </div>
  );
}

/** Čím se dá soubor vykreslit. Rozhoduje přípona — jiné vodítko tu nemáme. */
function druhSouboru(nazev: string | null): 'pdf' | 'obrazek' | 'jine' {
  const pripona = (nazev || '').toLowerCase().split('.').pop() ?? '';
  if (pripona === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'avif', 'bmp'].includes(pripona)) {
    return 'obrazek';
  }
  // Bez názvu (starší doklady) zkusíme PDF - účtenky jsou skoro vždycky PDF
  // nebo fotka a iframe si s obrázkem poradí taky.
  return nazev ? 'jine' : 'pdf';
}
