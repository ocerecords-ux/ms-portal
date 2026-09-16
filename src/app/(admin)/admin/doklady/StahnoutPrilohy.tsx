'use client';

import { useMemo, useState } from 'react';

/**
 * STÁHNOUT PŘÍLOHY DOKLADŮ ZA MĚSÍC (zadání 16. 9. 2026: „potřebuji ještě mít
 * u Výdajů a faktur tlačítko, kdy můžu stáhnout kompletní přílohy dokladů za
 * minulý měsíc").
 *
 * Jeden ZIP místo dvaceti kliknutí — přesně to, co se jednou za měsíc posílá
 * účetní. Výchozí je MINULÝ měsíc, protože pro ten se to dělá; vedle je
 * i tenhle a pár předchozích, ať se dá dojet zpětně.
 *
 * Nejdřív se portál zeptá (probe), jestli je vůbec co stahovat. Teprve pak se
 * spustí stahování - prohlížeč si na tu adresu jde sám a případnou chybu by
 * jinak ukázal jako holý JSON místo hlášky.
 */
export function StahnoutPrilohy({ druh }: { druh: 'vydaje' | 'faktury' }) {
  const mesice = useMemo(() => posledniMesice(6), []);
  const [mesic, setMesic] = useState(mesice[0].hodnota);
  const [bezi, setBezi] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);

  async function stahni() {
    setBezi(true);
    setZprava(null);
    try {
      const adresa = `/api/admin/doklady/prilohy-zip?druh=${druh}&mesic=${encodeURIComponent(mesic)}`;
      const res = await fetch(`${adresa}&probe=1`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setZprava(
          data?.error ||
            (druh === 'vydaje'
              ? 'Za ten měsíc není u výdajů žádná příloha.'
              : 'Za ten měsíc není vystavená žádná faktura.'),
        );
        return;
      }
      // Kolik dokladů přílohu nemá, ať se po nich dá jít.
      if (data.bezPrilohy > 0) {
        setZprava(
          `Stahuji ${data.pocet} souborů. ${data.bezPrilohy} ${sklonujDoklady(data.bezPrilohy)} přílohu nemá.`,
        );
      } else {
        setZprava(`Stahuji ${data.pocet} souborů.`);
      }
      window.location.href = adresa;
    } catch {
      setZprava('Stažení se nepodařilo.');
    } finally {
      setBezi(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1 items-start">
      <span className="inline-flex items-center gap-2">
        <select
          value={mesic}
          onChange={(e) => setMesic(e.target.value)}
          className="rounded-lg border border-line bg-field px-2.5 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple"
        >
          {mesice.map((m) => (
            <option key={m.hodnota} value={m.hodnota}>
              {m.popisek}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void stahni()}
          disabled={bezi}
          className="text-sm font-heading font-semibold rounded-lg border border-line px-3 py-2 text-ink hover:border-brand-purple hover:text-brand-purple transition-colors disabled:opacity-60"
        >
          {bezi ? 'Připravuji…' : druh === 'vydaje' ? 'Stáhnout přílohy' : 'Stáhnout faktury'}
        </button>
      </span>
      {zprava && <span className="text-xs font-body text-muted">{zprava}</span>}
    </span>
  );
}

const NAZVY_MESICU = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

/**
 * Posledních pár měsíců, MINULÝM POČÍNAJE. Tenhle měsíc je až druhý v pořadí:
 * balík se dělá za uzavřený měsíc, a kdyby byl první v nabídce, stahoval by
 * se omylem rozdělaný.
 */
function posledniMesice(kolik: number): { hodnota: string; popisek: string }[] {
  const dnes = new Date();
  const out: { hodnota: string; popisek: string }[] = [];
  for (let i = 1; i <= kolik; i++) {
    const d = new Date(dnes.getFullYear(), dnes.getMonth() - i, 1);
    out.push({
      hodnota: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      popisek: `${NAZVY_MESICU[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  // Tenhle měsíc na konec - občas se hodí, ale nemá být po ruce jako první.
  out.push({
    hodnota: `${dnes.getFullYear()}-${String(dnes.getMonth() + 1).padStart(2, '0')}`,
    popisek: `${NAZVY_MESICU[dnes.getMonth()]} ${dnes.getFullYear()} (rozdělaný)`,
  });
  return out;
}

function sklonujDoklady(pocet: number): string {
  if (pocet === 1) return 'doklad';
  if (pocet >= 2 && pocet <= 4) return 'doklady';
  return 'dokladů';
}
