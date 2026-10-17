'use client';

import { useEffect, useRef, useState } from 'react';

import { usePreklad, useJazyk } from '@/app/(portal)/components/JazykProvider';
import { blizkost, popisTerminu, type BlizkostTerminu } from '@/lib/frekvenceProjektu';
import { kodJazyka, type Jazyk } from '@/lib/jazyk';
import type { RozpisHerce } from '@/lib/frekvenceProjektuServer';

/**
 * TERMÍNY NATÁČENÍ U NÁZVU PROJEKTU (připomínka Helči 15. 10. 2026: „bylo by
 * buď datum první frekvence a nebo úplně nejlépe počet dní do první
 * frekvence… hodilo by se mi, kdybych si mohla ty projekty seřadit právě od
 * první frekvence").
 *
 * V PŘEHLEDU JE JEN IKONA KALENDÁŘE (upřesnění 15. 10. 2026: „udělal bych tam
 * spíš nějakou ikonku kalendáře a po kliknutí by se ukázaly termíny"). Pro
 * sloupec už v tabulce není místo a ikona se vejde za název stejně jako
 * kolečko série - řádek se o ni nezvýší.
 *
 * MĚNÍ SE JEN BARVA: červená dnes a zítra, oranžová do týdne, šedá dál,
 * tmavá u projektu, který se už točí. Nejbližší termín tím na sebe upozorní
 * sám, aniž by se do řádku psalo cokoliv navíc. Přesný termín je v bublině,
 * takže kvůli jednomu datu není třeba nic rozklikávat.
 *
 * ROZPIS SE NAČÍTÁ AŽ PŘI OTEVŘENÍ, stejně jako díly série - sedm set
 * projektů v seznamu znamená sedm set rozpisů, které si nikdo neotevře.
 */
const BARVA: Record<BlizkostTerminu, string> = {
  dnes: 'text-danger',
  brzy: 'text-status-progress',
  klid: 'text-muted',
  minulost: 'text-line',
};

export function OdznakFrekvenci({
  caflouProjectId,
  prvni,
  pocet,
  velky = false,
}: {
  caflouProjectId: string;
  /** Nejbližší neodbytá frekvence v ISO; bez ní se odznak nevykresluje. */
  prvni: string;
  pocet: number;
  velky?: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [otevreno, setOtevreno] = useState(false);
  const [rozpis, setRozpis] = useState<RozpisHerce[]>([]);
  const [nacitam, setNacitam] = useState(false);
  const nacteno = useRef(false);
  const obal = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!otevreno || nacteno.current) return;
    nacteno.current = true;
    let zruseno = false;
    setNacitam(true);
    fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/frekvence`)
      .then((r) => r.json())
      .then((data) => {
        if (!zruseno && Array.isArray(data?.rozpis)) setRozpis(data.rozpis as RozpisHerce[]);
      })
      .catch((err) => {
        console.error('Rozpis natáčení se nepodařilo načíst:', err);
        nacteno.current = false;
      })
      .finally(() => {
        if (!zruseno) setNacitam(false);
      });
    return () => {
      zruseno = true;
    };
  }, [otevreno, caflouProjectId]);

  // Zavře se kliknutím vedle i Escapem - okénko nesmí viset nad tabulkou.
  useEffect(() => {
    if (!otevreno) return;
    function vedle(e: MouseEvent) {
      if (!obal.current?.contains(e.target as Node)) setOtevreno(false);
    }
    function klavesa(e: KeyboardEvent) {
      if (e.key === 'Escape') setOtevreno(false);
    }
    document.addEventListener('mousedown', vedle);
    document.addEventListener('keydown', klavesa);
    return () => {
      document.removeEventListener('mousedown', vedle);
      document.removeEventListener('keydown', klavesa);
    };
  }, [otevreno]);

  const termin = new Date(prvni);
  const jak = blizkost(termin) ?? 'klid';
  const popis =
    jak === 'minulost'
      ? t('frekvence.zacaloSe', { kdy: popisTerminu(termin, t, jazyk) })
      : t('frekvence.prvniFrekvence', { kdy: popisTerminu(termin, t, jazyk) });

  /** Nejbližší termín napříč všemi herci - ten se v rozpisu podbarví. */
  const nejblizsi = rozpis
    .flatMap((r) => r.frekvence.map((f) => f.start))
    .filter((s) => new Date(s).getTime() >= Date.now())
    .sort()[0];

  return (
    <span ref={obal} className="relative inline-block align-middle">
      <button
        type="button"
        onClick={(e) => {
          // V tabulce bývá celý řádek odkaz - ikona nesmí otevřít projekt.
          e.preventDefault();
          e.stopPropagation();
          setOtevreno((v) => !v);
        }}
        title={popis}
        aria-label={popis}
        aria-expanded={otevreno}
        className={`inline-grid place-items-center align-middle ml-2 shrink-0 cursor-pointer border-0 bg-transparent p-0 ${BARVA[jak]} hover:text-brand-purple transition-colors ${
          velky ? 'w-6 h-6' : 'w-5 h-5'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={velky ? 'w-4 h-4' : 'w-3.5 h-3.5'}
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {otevreno && (
        <span
          className={`absolute z-30 top-[calc(100%+4px)] left-0 max-w-[88vw] bg-surface border border-line rounded-card shadow-lg p-3.5 text-left block cursor-default ${
            rozpis.length > 1 ? 'w-[460px]' : 'w-[290px]'
          }`}
        >
          <span className="block text-[11px] font-body text-muted">
            {nacitam ? t('obecne.nacitam') : t('frekvence.pocetFrekvenci', { pocet })}
          </span>
          {rozpis.length > 0 && (
            <span className={`mt-2 ${rozpis.length > 1 ? 'flex gap-3.5 flex-col sm:flex-row' : 'block'}`}>
              {rozpis.map((r) => (
                <span key={r.herec || 'bez-herce'} className="flex-1 min-w-0 block">
                  {/* Hlavička se jménem jen u dvou a víc herců - u jednoho
                      ho má člověk ve sloupci Herec vedle. */}
                  {rozpis.length > 1 && (
                    <span className="flex items-center gap-2 text-[11px] font-heading font-bold text-ink pb-1.5 border-b border-line">
                      <span className="truncate">{r.herec || t('frekvence.bezHerce')}</span>
                      <span className="inline-grid place-items-center min-w-[17px] h-[17px] px-1 rounded-full bg-field text-muted text-[10px] tabular-nums shrink-0">
                        {r.frekvence.length}
                      </span>
                    </span>
                  )}
                  <span className="flex flex-col gap-px mt-1.5">
                    {r.frekvence.map((f, i) => {
                      const start = new Date(f.start);
                      const bylo = start.getTime() < Date.now();
                      const jeNejblizsi = f.start === nejblizsi;
                      return (
                        <span
                          key={f.id}
                          className={`flex items-baseline gap-2 text-xs rounded-md px-1.5 py-1 ${
                            jeNejblizsi ? 'bg-field' : ''
                          }`}
                        >
                          <span className="text-[10.5px] text-muted tabular-nums shrink-0 w-4">{i + 1}.</span>
                          <span
                            className={`whitespace-nowrap tabular-nums ${
                              jeNejblizsi
                                ? 'text-status-progress font-semibold'
                                : bylo
                                  ? 'text-muted'
                                  : 'text-ink font-semibold'
                            }`}
                          >
                            {denAMesic(jazyk, start)}
                          </span>
                          <span className="text-[11px] text-muted whitespace-nowrap">{hodina(jazyk, start)}</span>
                          <span className="text-[11px] text-muted whitespace-nowrap ml-auto truncate">
                            {f.studio}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                </span>
              ))}
            </span>
          )}
          {!nacitam && rozpis.length === 0 && (
            <span className="block text-xs font-body text-muted mt-2">{t('frekvence.zadneTerminy')}</span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * „po 19. 10." / „Mon 19/10" - den v týdnu je to, podle čeho se produkce
 * orientuje. Jazyk chodí PARAMETREM (modulová funkce, hook v ní být nemůže);
 * do dávky 7n tu byl `cs-CZ` natvrdo, takže rozpis frekvencí byl v anglickém
 * portálu jediné české místo u názvu projektu.
 */
function denAMesic(jazyk: Jazyk, d: Date): string {
  const kod = kodJazyka(jazyk);
  const den = new Intl.DateTimeFormat(kod, { weekday: 'short' }).format(d).replace('.', '');
  const datum = new Intl.DateTimeFormat(kod, { day: 'numeric', month: 'numeric' }).format(d);
  return `${den} ${datum}`;
}

function hodina(jazyk: Jazyk, d: Date): string {
  return new Intl.DateTimeFormat(kodJazyka(jazyk), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}
