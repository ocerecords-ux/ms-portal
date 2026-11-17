'use client';

import type { ProjectPriority } from '@prisma/client';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * PRIORITA GRAFICKY (zadání 18. 9. 2026: „ještě bych předělal nějak pole
 * Priorita. Nepsal bych to slovem, ale udělal graficky nějak, třeba ikonou").
 *
 * DVĚ ÚROVNĚ, NE TŘI (zadání 17. 11. 2026: „pojďme ještě vymyslet jen dvě
 * ikony priority projektu. Zelenou, když je to normální priorita a nespěchá,
 * a červenou, když je to vysoká. Jen se to zapne v případě, že spěchá a má
 * vysokou prioritu." - a „nazvěme ty priority jako normální a vysoká").
 *
 * Tři sloupečky znamenaly, že sloupec Priorita svítil oranžově u každého
 * projektu, protože skoro všechno bylo „střední" - a co svítí pořád, to oko
 * přestane vidět. Teď jsou stavy dva:
 *
 *   normální (zelený prstenec)  - nespěchá, výchozí stav
 *   vysoká   (červené kolečko s vykřičníkem) - spěchá
 *
 * V PŘEHLEDU PROJEKTŮ SE KRESLÍ JEN VYSOKÁ (`vPrehledu`), normální zůstane
 * prázdná buňka. Jinak by byl sloupec zase plný a červená by nic neznamenala.
 * Na kartě projektu a v zakládání se kreslí obojí - musí být kam klepnout.
 *
 * TVAR, NE JEN BARVA. Červená se zelenou je nejčastější porucha barvocitu,
 * takže se obě ikony liší i kresbou: prstenec je dutý a tenký, vysoká je
 * vyplněná a je v ní vykřičník. V bublině je navíc celé slovo.
 *
 * KLEPNUTÍ PŘEKLÁPÍ TAM A ZPĚT. Dřív se čárky přidávaly dokola přes tři
 * stupně; u dvou stavů je to prostý přepínač.
 *
 * Kreslí to jediná funkce `Kresba` - kdyby měl náhled a úprava vlastní
 * kresbu, rozešly by se při první úpravě jedné z nich.
 */

/** Jediná hodnota, která v portálu znamená „spěchá". */
export function jeVysoka(priorita: ProjectPriority | null | undefined): boolean {
  return priorita === 'HIGH';
}

/**
 * Stará `LOW` zůstává v číselníku kvůli datům, která v databázi vznikla před
 * 17. 11. 2026 - čte se jako normální. Jednorázový převod na `MEDIUM` dělá
 * seed (značka `priorita-dve-urovne`).
 */
const KLIC_NAZVU = {
  normalni: 'priorita.normalni',
  vysoka: 'priorita.vysoka',
} as const;

function Kresba({ vysoka, velikost }: { vysoka: boolean; velikost: number }) {
  // Vykricnik se "vykousne" podkladem karty, ne bilou - bila by na tmavem
  // rezimu zarila a na zelenou se podle pravidla portalu bile nedava.
  return (
    <svg
      width={velikost}
      height={velikost}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="block"
    >
      {vysoka ? (
        <>
          <circle cx="9" cy="9" r="7" fill="currentColor" />
          <rect x="8.1" y="4.4" width="1.8" height="5.5" rx="0.9" className="fill-surface" />
          <circle cx="9" cy="12.6" r="1.05" className="fill-surface" />
        </>
      ) : (
        <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeWidth="1.7" />
      )}
    </svg>
  );
}

/**
 * Náhled - jen kresba, nikde se na ni neklepe.
 *
 * `vPrehledu` je tabulka projektů: tam se normální priorita nekreslí vůbec.
 */
export function IkonaPriority({
  priorita,
  velikost = 16,
  vPrehledu = false,
}: {
  priorita: ProjectPriority | null | undefined;
  velikost?: number;
  /** Tabulka projektů - normální priorita zůstane prázdná buňka. */
  vPrehledu?: boolean;
}) {
  const t = usePreklad();
  const vysoka = jeVysoka(priorita);
  if (!vysoka && vPrehledu) return null;

  const popisek = t(vysoka ? KLIC_NAZVU.vysoka : KLIC_NAZVU.normalni);

  return (
    <span
      title={t('priorita.bublina', { stupen: popisek })}
      aria-label={t('priorita.bublina', { stupen: popisek })}
      role="img"
      className={`inline-flex items-center align-middle ${vysoka ? 'text-danger' : 'text-status-done'}`}
      style={{ height: velikost }}
    >
      <Kresba vysoka={vysoka} velikost={velikost} />
    </span>
  );
}

/**
 * Úprava - tatáž kresba, jen je z ní tlačítko.
 *
 * Tady se normální priorita kreslí vždycky (i v tabulce): musí být kam
 * klepnout, jinak by spěch nešel zapnout tam, kde zatím není.
 */
export function VyberPriority({
  priorita,
  onZmena,
  velikost = 18,
  uklada = false,
}: {
  priorita: ProjectPriority | null | undefined;
  onZmena: (nova: ProjectPriority) => void;
  velikost?: number;
  /** Ukládá se - ať je vidět, že se něco děje, a neklepe se dvakrát. */
  uklada?: boolean;
}) {
  const t = usePreklad();
  const vysoka = jeVysoka(priorita);
  // Prazdna priorita (projekt bez karty ProjectMeta) se cte jako normalni,
  // takze prvni klepnuti zapne spech - presne to, kvuli cemu na ikonu kliknes.
  const dalsi: ProjectPriority = vysoka ? 'MEDIUM' : 'HIGH';
  const popisek = t(vysoka ? KLIC_NAZVU.vysoka : KLIC_NAZVU.normalni);
  const nazevDalsi = t(vysoka ? KLIC_NAZVU.normalni : KLIC_NAZVU.vysoka);

  return (
    <button
      type="button"
      disabled={uklada}
      onClick={() => onZmena(dalsi)}
      title={t('priorita.bublinaKlepnuti', { stupen: popisek, dalsi: nazevDalsi.toLowerCase() })}
      aria-label={t('priorita.bublinaKlepnutiPopis', { stupen: popisek, dalsi: nazevDalsi })}
      className={`inline-flex items-center align-middle px-1.5 py-1 -mx-1.5 -my-1 rounded ${
        vysoka ? 'text-danger' : 'text-status-done'
      } ${uklada ? 'opacity-60' : 'hover:bg-field'}`}
      style={{ height: velikost + 8 }}
    >
      <Kresba vysoka={vysoka} velikost={velikost} />
    </button>
  );
}
