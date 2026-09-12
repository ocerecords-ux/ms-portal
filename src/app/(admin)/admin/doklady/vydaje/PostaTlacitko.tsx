'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StavPosty, VysledekKontroly } from '@/lib/posta';

/**
 * Kontrola schránky s doklady (zadání 12. 9. 2026: „potřeboval bych z toho
 * mailu vytáhnout přílohy a naše účetní pak měla možnost, že se jí to objeví
 * v záložce Výdaje jako nezařazené").
 *
 * Schránka se čte, když účetní otevře Výdaje - tedy přesně tehdy, kdy má
 * doklady vidět. Tlačítko vedle je pro případ, že zrovna čeká na fakturu,
 * která právě dorazila.
 *
 * Jedno kolo bere jen pár zpráv a pár dokladů pošle ke čtení, aby se nečekalo
 * minutu na odpověď. Když ve schránce něco zbylo, komponenta si řekne znovu.
 */
export function PostaTlacitko({ stav }: { stav: StavPosty }) {
  const router = useRouter();
  const [bezi, setBezi] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(stav.posledniChyba);
  const samo = useRef(false);

  async function zkontroluj(automaticky = false): Promise<void> {
    if (!stav.nastaveno) return;
    setBezi(true);
    if (!automaticky) setHlaska(null);
    try {
      let kolo = 0;
      let zalozenoCelkem = 0;
      let prectenoCelkem = 0;
      // Nejvys tri kola - aby se portál nezakousl do schránky s tisícem zpráv.
      for (;;) {
        const res = await fetch('/api/admin/posta', { method: 'POST', cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as Partial<VysledekKontroly> & { error?: string };
        if (!res.ok) {
          setChyba(data?.error || 'Do schránky se nepodařilo podívat.');
          return;
        }
        zalozenoCelkem += data.zalozeno ?? 0;
        prectenoCelkem += data.precteno ?? 0;
        setChyba(data.chyba ?? null);
        kolo += 1;
        const pokracovat = Boolean(data.zbyva) || (data.precteno ?? 0) > 0;
        if (!pokracovat || kolo >= 3) break;
      }

      if (zalozenoCelkem > 0 || prectenoCelkem > 0) {
        setHlaska(
          zalozenoCelkem > 0
            ? `Nových dokladů: ${zalozenoCelkem}`
            : `Přečteno dokladů: ${prectenoCelkem}`,
        );
        router.refresh();
      } else if (!automaticky) {
        setHlaska('Nic nového.');
      }
    } catch {
      setChyba('Do schránky se nepodařilo podívat.');
    } finally {
      setBezi(false);
    }
  }

  // Jednou po otevření stránky. Ref proto, že React ve vývoji spouští efekty
  // dvakrát a schránka by se četla nadvakrát.
  useEffect(() => {
    if (samo.current || !stav.nastaveno) return;
    samo.current = true;
    void zkontroluj(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stav.nastaveno) {
    return (
      <span className="text-xs font-body text-muted" title="Doplňte IMAP_HOST, IMAP_USER a IMAP_PASSWORD.">
        Schránka s doklady není nastavená
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void zkontroluj()}
        disabled={bezi}
        className="font-heading font-semibold text-sm rounded-lg px-4 py-2 border border-line text-ink hover:bg-field transition-colors disabled:opacity-60"
      >
        {bezi ? 'Kontroluji poštu…' : 'Zkontrolovat poštu'}
      </button>
      {chyba ? (
        <span className="text-xs font-body text-danger max-w-[320px]">{chyba}</span>
      ) : (
        hlaska && <span className="text-xs font-body text-muted">{hlaska}</span>
      )}
    </span>
  );
}
