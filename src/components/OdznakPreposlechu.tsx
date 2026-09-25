/**
 * JAK DALEKO JE PŘEPOSLECH (zadání 25. 9. 2026: „chtělo by to nějakou ikonu,
 * že se částečně zapisují chyby v AudioTaggeru u projektu a pak když už je
 * přeposlechnuto komplet. Mělo by to být v detailu projektu i v přehledu").
 *
 * Tři stavy, jedna sluchátka:
 *   – zelená s fajfkou   … klient dal PŘEPOSLECHNUTO, hotovo
 *   – oranžová s číslem  … běží to: někdo zapisuje chyby nebo poslouchá
 *   – šedá               … stopy nachystané, zatím se nikdo neozval
 * Projekt, kde není ani stopa ani záznam, nemá co ukazovat a odznak se
 * nekreslí vůbec — v přehledu by z toho byl sloupec samých pomlček.
 *
 * ČÍSLO V ODZNAKU JSOU ZAPSANÉ CHYBY, ne procenta: procenta se počítají jen
 * z poslechu klienta s otevřeným textem, takže u naší vlastní kontroly
 * zůstávají prázdná — a přitom je to ta chvíle, kdy se chyby sypou nejvíc.
 * Procenta jsou v bublinkové nápovědě spolu se zbytkem.
 */
export type StavPreposlechu = {
  /** Kolik stop je v AudioTaggeru nachystaných. */
  stop: number;
  /** Kolik z nich už někdo doposlechl do konce. */
  poslechnuto: number;
  /** Klepnuto na PŘEPOSLECHNUTO. */
  hotovo: boolean;
  /** Kolik záznamů chyb je zapsaných. */
  chyb: number;
  /** Procento textu, které klient přeposlechl; null = nevíme. */
  procent?: number | null;
};

function Sluchatka({ trida }: { trida: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={trida}
      aria-hidden="true"
    >
      {/* Oblouk přes hlavu a dvě mušle - poznatelné i ve 14 pixelech. */}
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="2.5" y="13.5" width="4" height="6.5" rx="1.6" />
      <rect x="17.5" y="13.5" width="4" height="6.5" rx="1.6" />
    </svg>
  );
}

function popis(stav: StavPreposlechu): string {
  const casti: string[] = [];
  if (stav.stop > 0) casti.push(`${stav.poslechnuto} z ${stav.stop} stop doposlechnuto`);
  if (stav.chyb > 0) casti.push(`${stav.chyb} zapsaných chyb`);
  if (typeof stav.procent === 'number') casti.push(`${stav.procent} % textu`);
  const detail = casti.length ? ` — ${casti.join(' · ')}` : '';
  if (stav.hotovo) return `Přeposlechnuto komplet${detail}`;
  if (stav.chyb > 0 || stav.poslechnuto > 0 || (stav.procent ?? 0) > 0)
    return `Přeposlech běží${detail}`;
  return `Nachystáno k přeposlechu${detail}`;
}

export function OdznakPreposlechu({
  stav,
  /** `ikona` do tabulky, `odznak` s textem do hlavičky detailu. */
  varianta = 'ikona',
}: {
  stav: StavPreposlechu | null | undefined;
  varianta?: 'ikona' | 'odznak';
}) {
  if (!stav) return null;
  const bezi = !stav.hotovo && (stav.chyb > 0 || stav.poslechnuto > 0 || (stav.procent ?? 0) > 0);
  // Nic nachystaného a nic zapsaného - není o čem informovat.
  if (!stav.hotovo && !bezi && stav.stop === 0) return null;

  const barva = stav.hotovo
    ? 'bg-okTint text-status-done border-status-done/30'
    : bezi
      ? 'bg-warnTint text-status-progress border-status-progress/30'
      : 'bg-field text-muted border-line';

  const titulek = popis(stav);
  const cislo = stav.hotovo ? null : stav.chyb > 0 ? stav.chyb : null;

  return (
    <span
      title={titulek}
      aria-label={titulek}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 font-heading text-xs font-semibold whitespace-nowrap ${barva}`}
    >
      <Sluchatka trida="w-3.5 h-3.5 shrink-0" />
      {stav.hotovo ? (
        <span aria-hidden="true">✓</span>
      ) : cislo !== null ? (
        <span className="tabular-nums">{cislo}</span>
      ) : null}
      {varianta === 'odznak' && (
        <span>
          {stav.hotovo
            ? 'Přeposlechnuto'
            : bezi
              ? 'Přeposlech běží'
              : 'Nachystáno k přeposlechu'}
        </span>
      )}
    </span>
  );
}
