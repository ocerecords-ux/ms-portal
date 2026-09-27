'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HromadneMazani, VyberRadku } from '@/components/HromadneMazani';
import {
  RaditelnaTabulka,
  moznostiZ,
  type SloupecTabulky,
} from '@/app/(portal)/components/RaditelnaTabulka';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

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
  const t = usePreklad();
  const jazyk = useJazyk();
  const [vybrane, setVybrane] = useState<Set<string>>(new Set());

  const sloupce: SloupecTabulky<SmlouvaRadek>[] = [
    ...(lzeMazat
      ? [
          {
            key: 'vyber',
            label: '',
            trida: 'w-8',
            bunka: (r: SmlouvaRadek) => (
              <VyberRadku
                zaskrtnuto={vybrane.has(r.id)}
                onZmena={() =>
                  setVybrane((v) => {
                    const dalsi = new Set(v);
                    if (dalsi.has(r.id)) dalsi.delete(r.id);
                    else dalsi.add(r.id);
                    return dalsi;
                  })
                }
                popisek={t('smlouva.vybratRadek', { nazev: r.nazev })}
              />
            ),
          } as SloupecTabulky<SmlouvaRadek>,
        ]
      : []),
    {
      key: 'nazev',
      label: t('smlouva.sloupecNazev'),
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
      label: t('smlouva.sloupecPodepisujici'),
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
      label: t('smlouva.sloupecVytvoreno'),
      hodnota: (r) => r.vytvorenoMs,
      trida: 'text-muted tabular-nums whitespace-nowrap',
      bunka: (r) => r.vytvoreno,
    },
    {
      key: 'podpisy',
      label: t('smlouva.sloupecPodpisy'),
      // Kolik podpisu chybi - nedopodepsane smlouvy jdou napred.
      hodnota: (r) => (r.podepsalaMediaspace ? 1 : 0) + (r.podepsalaProtistrana ? 1 : 0),
      trida: 'text-xs whitespace-nowrap',
      bunka: (r) => (
        <>
          <span className={r.podepsalaMediaspace ? 'text-status-done' : 'text-muted'}>
            {r.podepsalaMediaspace ? '✓' : '○'} Mediaspace
          </span>
          <span className={`block ${r.podepsalaProtistrana ? 'text-status-done' : 'text-muted'}`}>
            {r.podepsalaProtistrana ? '✓' : '○'} {t('smlouva.protistranaKratce')}
          </span>
        </>
      ),
    },
    {
      key: 'stav',
      label: t('smlouva.sloupecStav'),
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
      jazyk={jazyk}
      prazdno={t('smlouva.tabulkaPrazdna')}
      minSirka={860}
      hledat={(r) =>
        `${r.nazev} ${r.cislo} ${r.projekt ?? ''} ${r.podepisujici} ${r.podepisujiciDoplnek} ${r.stav}`
      }
      hledatPlaceholder={t('smlouva.hledatPlaceholder')}
      filtry={[
        {
          key: 'podepisujici',
          label: t('smlouva.sloupecPodepisujici'),
          moznosti: moznostiZ(radky, (r) => r.podepisujici),
          vyhovuje: (r, h) => r.podepisujici === h,
        },
        {
          key: 'projekt',
          label: t('smlouva.sloupecProjekt'),
          moznosti: moznostiZ(radky, (r) => r.projekt),
          vyhovuje: (r, h) => r.projekt === h,
        },
        {
          key: 'stav',
          label: t('smlouva.sloupecStav'),
          moznosti: moznostiZ(radky, (r) => r.stav),
          vyhovuje: (r, h) => r.stav === h,
        },
      ]}
      rozsahDatumu={{ label: t('smlouva.sloupecVytvoreno'), ms: (r) => r.vytvorenoMs }}
      hromadneAkce={
        lzeMazat
          ? (viditelne) => (
              <HromadneMazani
                viditelneIds={viditelne.map((r) => r.id)}
                vybrane={vybrane}
                onZmena={setVybrane}
                endpoint="/api/admin/contracts/hromadne-smazani"
                poznamka={t('smlouva.hromadneMazaniPoznamka')}
              />
            )
          : undefined
      }
    />
  );
}
