'use client';

import { useEffect, useMemo, useState } from 'react';
import { GRID_START_HOUR, HOUR_PX, minutesInZone } from '@/lib/calendar';

/**
 * ČÁRA „TEĎ" JAKO ZVUKOVÁ VLNA (zadání 29. 9. 2026: „ta čárka v kalendáři by
 * mohla vycházet ze zvukové vlny, trošku to udělat umělecké. Ale aby pak bylo
 * jasné, ve které fázi dne a hodině právě teď jsme. Zkus to nějak vymyslet,
 * nějakou decentnost").
 *
 * DVĚ VRSTVY, A TO SCHVÁLNĚ:
 *  1. vlas přes celou šířku - ten drží PŘESNÝ čas. Kdyby tam byla jen vlna,
 *     oko by minutu hádalo podle nejbližšího pruhu.
 *  2. vlna z pruhů nad ním - to je ta ozdoba. Začíná u tečky vlevo a doprava
 *     se ztišuje, takže přes text událostí přejde jako nic.
 *
 * VLNA SE HÝBE. Pruhy se počítají z minuty dne, takže se každou půlminutu
 * překreslí trochu jinak - kalendář tím vypadá živě a zároveň je na první
 * pohled vidět, že čára ukazuje TEĎ, ne nějakou značku v rozvrhu.
 *
 * HLASITOST PODLE FÁZE DNE (druhá půlka zadání). Ráno a večer je vlna nízká,
 * kolem druhé odpoledne nejvyšší - ve studiu je to ta nejhlučnější část dne.
 * Není to měřidlo, je to nálada; přesné údaje jsou vlas a čas vpravo.
 */

/** Kolik pruhů se nakreslí. Víc už na šířce sloupce splyne v šedý pruh. */
const POCET_PRUHU = 44;
/** Poloviční výška nejvyššího pruhu v pixelech - vlna sahá nahoru i dolů. */
const NEJVYSSI = 8;
/** Jak často se vlna překreslí a čas posune. */
const TIK_MS = 30_000;

/** 0 (ticho) až 1 (nejhlasitěji) podle denní doby; vrchol kolem 14:00. */
function hlasitostDne(minuta: number): number {
  const odVrcholu = Math.abs(minuta - 14 * 60) / (10 * 60);
  return 0.4 + 0.6 * Math.max(0, 1 - odVrcholu * odVrcholu);
}

/**
 * Výška pruhu 0..1. Tři sinusovky přes sebe - žádná náhoda, aby se obrázek
 * na serveru a v prohlížeči nerozešel a aby vlna „tekla", ne blikala.
 */
function vyskaPruhu(i: number, minuta: number): number {
  const s =
    Math.sin(i * 0.9 + minuta * 0.08) +
    0.55 * Math.sin(i * 0.31 - minuta * 0.021) +
    0.3 * Math.sin(i * 2.7 + minuta * 0.013);
  return Math.abs(s) / 1.85;
}

export function CaraTed({ timezone }: { timezone: string }) {
  /**
   * Vykresluje se až v prohlížeči. Čas na serveru a na obrazovce se liší
   * o dobu, než se stránka načte, a React by si na to stěžoval.
   */
  const [minuta, setMinuta] = useState<number | null>(null);

  useEffect(() => {
    const zmer = () => setMinuta(minutesInZone(new Date(), timezone));
    zmer();
    const casovac = window.setInterval(zmer, TIK_MS);
    return () => window.clearInterval(casovac);
  }, [timezone]);

  const pruhy = useMemo(() => {
    if (minuta === null) return [];
    const hlasitost = hlasitostDne(minuta);
    return Array.from({ length: POCET_PRUHU }, (_, i) => {
      // Doprava se vlna ztišuje, ať nepřebíjí názvy událostí.
      const utlum = (1 - i / POCET_PRUHU) ** 1.6;
      return Math.max(1, NEJVYSSI * 2 * vyskaPruhu(i, minuta) * hlasitost * utlum);
    });
  }, [minuta]);

  if (minuta === null) return null;

  const hodina = Math.floor(minuta / 60);
  const cas = `${hodina}:${String(minuta % 60).padStart(2, '0')}`;

  return (
    <div
      className="absolute left-0 right-0 z-[500] pointer-events-none"
      style={{ top: `${((minuta - GRID_START_HOUR * 60) * HOUR_PX) / 60}px` }}
      aria-hidden
    >
      {/* Vlas = přesný čas. Slabší než dřív, protože nad ním svítí vlna. */}
      <span className="absolute left-0 right-0 top-0 h-px bg-brand-green/70" />

      {/* Tečka na začátku - jediné, co ze staré čáry zůstalo beze změny. */}
      <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-brand-green" />

      <span
        className="absolute left-2 right-10 flex items-center justify-between gap-[1px] overflow-hidden"
        style={{ height: NEJVYSSI * 2, top: -NEJVYSSI }}
      >
        {pruhy.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-full bg-brand-green"
            style={{ height: `${v}px`, opacity: 0.85 - (i / POCET_PRUHU) * 0.45 }}
          />
        ))}
      </span>

      {/* Hodina a minuta vpravo, kde text událostí nebývá. */}
      <span className="absolute right-0 -top-[7px] text-[10px] leading-[14px] font-heading font-semibold tabular-nums text-brand-greenDeep dark:text-brand-green bg-surface/85 rounded-pill px-1">
        {cas}
      </span>
    </div>
  );
}
