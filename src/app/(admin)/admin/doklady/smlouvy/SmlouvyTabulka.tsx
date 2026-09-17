'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RaditelnaTabulka,
  moznostiZ,
  type SloupecTabulky,
} from '@/app/(portal)/components/RaditelnaTabulka';

/**
 * Tabulka smluv, řaditelná kliknutím na název sloupce (zadání 9. 9. 2026).
 * Stránka zůstává serverová a posílá sem hotové řádky.
 */

export type SmlouvaRadek = {
  id: string;
  nazev: string;
  cislo: string;
  projekt: string | null;
  podepisujici: string;
  podepisujiciDoplnek: string;
  vytvoreno: string;
  vytvorenoMs: number | null;
  podepsalaMediaspace: boolean;
  podepsalaProtistrana: boolean;
  stav: string;
  stavTrida: string;
};

export function SmlouvyTabulka({
  radky,
  lzeMazat = false,
}: {
  radky: SmlouvaRadek[];
  /**
   * Zaškrtávátka a hromadné mazání (zadání 17. 9. 2026). Zapíná se jen
   * v záložce „Odmítnuté a zrušené" - jinde se smlouvy mažou po jedné
   * v detailu, aby se omylem nesmazalo něco, co ještě běží.
   */
  lzeMazat?: boolean;
}) {
  const router = useRouter();
  const [vybrane, setVybrane] = useState<Set<string>>(new Set());
  const [bezi, setBezi] = useState(false);
  const [potvrzeni, setPotvrzeni] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  function prepni(id: string) {
    setPotvrzeni(false);
    setVybrane((s) => {
      const dalsi = new Set(s);
      if (dalsi.has(id)) dalsi.delete(id);
      else dalsi.add(id);
      return dalsi;
    });
  }

  async function smazVybrane() {
    if (vybrane.size === 0 || bezi) return;
    if (!potvrzeni) {
      setPotvrzeni(true);
      return;
    }
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/contracts/hromadne-smazani', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...vybrane] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || 'Smazání se nezdařilo.');
        return;
      }
      setVybrane(new Set());
      setPotvrzeni(false);
      router.refresh();
    } catch {
      setChyba('Smazání se nezdařilo.');
    } finally {
      setBezi(false);
    }
  }

  const sloupce: SloupecTabulky<SmlouvaRadek>[] = [
    ...(lzeMazat
      ? [
          {
            key: 'vyber',
            label: '',
            trida: 'w-8',
            bunka: (r: SmlouvaRadek) => (
              <input
                type="checkbox"
                checked={vybrane.has(r.id)}
                onChange={() => prepni(r.id)}
                aria-label={`Vybrat smlouvu ${r.nazev}`}
                className="w-4 h-4 accent-brand-purple cursor-pointer"
              />
            ),
          } as SloupecTabulky<SmlouvaRadek>,
        ]
      : []),
    {
      key: 'nazev',
      label: 'Název',
      hodnota: (r) => r.nazev,
      trida: 'font-semibold',
      bunka: (r) => (
        <>
          <Link
            href={`/admin/doklady/smlouvy/${r.id}`}
            className="text-ink hover:text-brand-purple no-underline"
          >
            {r.nazev}
          </Link>
          <span className="block text-xs text-muted font-body">
            <span className="tabular-nums">{r.cislo}</span>
            {r.projekt ? ` · ${r.projekt}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'podepisujici',
      label: 'Podepisující',
      hodnota: (r) => r.podepisujici,
      trida: 'text-muted whitespace-nowrap',
      bunka: (r) => (
        <>
          {r.podepisujici}
          <span className="block text-xs font-body">{r.podepisujiciDoplnek}</span>
        </>
      ),
    },
    {
      key: 'vytvoreno',
      label: 'Vytvořeno',
      hodnota: (r) => r.vytvorenoMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.vytvoreno,
    },
    {
      key: 'podpisy',
      label: 'Podpisy',
      // Kolik podpisu chybi - nedopodepsane smlouvy jdou napred.
      hodnota: (r) => (r.podepsalaMediaspace ? 1 : 0) + (r.podepsalaProtistrana ? 1 : 0),
      trida: 'text-xs whitespace-nowrap',
      bunka: (r) => (
        <>
          <span className={r.podepsalaMediaspace ? 'text-status-done' : 'text-muted'}>
            {r.podepsalaMediaspace ? '✓' : '○'} Mediaspace
          </span>
          <span className={`block ${r.podepsalaProtistrana ? 'text-status-done' : 'text-muted'}`}>
            {r.podepsalaProtistrana ? '✓' : '○'} protistrana
          </span>
        </>
      ),
    },
    {
      key: 'stav',
      label: 'Stav',
      hodnota: (r) => r.stav,
      trida: 'whitespace-nowrap',
      bunka: (r) => (
        <span
          className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${r.stavTrida}`}
        >
          {r.stav}
        </span>
      ),
    },
  ];

  return (
    <RaditelnaTabulka
      radky={radky}
      sloupce={sloupce}
      klicRadku={(r) => r.id}
      vychoziSloupec="vytvoreno"
      vychoziSmer="desc"
      prazdno="Tady zatím nic není."
      minSirka={860}
      hledat={(r) =>
        `${r.nazev} ${r.cislo} ${r.projekt ?? ''} ${r.podepisujici} ${r.podepisujiciDoplnek} ${r.stav}`
      }
      hledatPlaceholder="Hledat smlouvu, herce, projekt…"
      filtry={[
        {
          key: 'podepisujici',
          label: 'Podepisující',
          moznosti: moznostiZ(radky, (r) => r.podepisujici),
          vyhovuje: (r, h) => r.podepisujici === h,
        },
        {
          key: 'projekt',
          label: 'Projekt',
          moznosti: moznostiZ(radky, (r) => r.projekt),
          vyhovuje: (r, h) => r.projekt === h,
        },
        {
          key: 'stav',
          label: 'Stav',
          moznosti: moznostiZ(radky, (r) => r.stav),
          vyhovuje: (r, h) => r.stav === h,
        },
      ]}
      rozsahDatumu={{ label: 'Vytvořeno', ms: (r) => r.vytvorenoMs }}
      hromadneAkce={
        lzeMazat
          ? (viditelne) => {
              // „Vybrat vše" bere jen to, co je po hledání a filtrech vidět.
              const vsechnyVybrane =
                viditelne.length > 0 && viditelne.every((r) => vybrane.has(r.id));
              return (
                <div className="bg-surface rounded-card border border-line shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vsechnyVybrane}
                      disabled={viditelne.length === 0}
                      onChange={() => {
                        setPotvrzeni(false);
                        setVybrane((s) => {
                          const dalsi = new Set(s);
                          if (vsechnyVybrane) viditelne.forEach((r) => dalsi.delete(r.id));
                          else viditelne.forEach((r) => dalsi.add(r.id));
                          return dalsi;
                        });
                      }}
                      className="w-4 h-4 accent-brand-purple"
                    />
                    <span className="text-sm font-body text-ink">
                      Vybrat vše{viditelne.length ? ` (${viditelne.length})` : ''}
                    </span>
                  </label>

                  <span className="text-sm font-body text-muted tabular-nums">
                    {vybrane.size > 0 ? `Vybráno: ${vybrane.size}` : 'Nic nevybráno'}
                  </span>

                  {vybrane.size > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setVybrane(new Set());
                        setPotvrzeni(false);
                      }}
                      className="text-sm font-heading text-brand-purple hover:underline"
                    >
                      Zrušit výběr
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void smazVybrane()}
                    disabled={vybrane.size === 0 || bezi}
                    className={`ml-auto text-sm font-heading font-semibold rounded-pill border px-4 py-2 transition-colors disabled:opacity-50 ${
                      potvrzeni
                        ? 'border-danger text-danger bg-dangerTint'
                        : 'border-line text-muted hover:border-danger hover:text-danger'
                    }`}
                  >
                    {bezi
                      ? 'Mažu…'
                      : potvrzeni
                        ? `Opravdu smazat ${vybrane.size}? Klepněte znovu`
                        : `Smazat vybrané${vybrane.size ? ` (${vybrane.size})` : ''}`}
                  </button>

                  {chyba && <p className="text-sm font-body text-danger m-0 w-full">{chyba}</p>}
                  <p className="text-xs font-body text-muted m-0 w-full">
                    Smazání je nevratné — smlouva zmizí i s podpisy. Podepsanou smlouvu portál
                    smazat nedovolí.
                  </p>
                </div>
              );
            }
          : undefined
      }
    />
  );
}
