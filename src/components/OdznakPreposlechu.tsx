/**
 * JAK DALEKO JE PŘEPOSLECH (zadání 25. 9. 2026: „chtělo by to nějakou ikonu,
 * že se částečně zapisují chyby v AudioTaggeru u projektu a pak když už je
 * přeposlechnuto komplet").
 *
 * UPŘESNĚNÍ TÉHOŽ DNE: „nedávej to jako další atribut (sloupec) v přehledu,
 * ale jako malou ikonu u typu projektu, co je před názvem. A chci jen dva
 * stavy. Oranžová ve chvíli, kdy tam bude v AudioTaggeru aspoň jeden záznam,
 * a zelená, když se dokončí přeposlech."
 *
 * Takže dva stavy a nic mezi tím:
 *   – oranžová … někdo zapisuje chyby (aspoň jeden záznam), hotovo ještě není
 *   – zelená   … přeposlechnuto komplet
 * Projekt, kde se ještě nikdo neozval, nemá odznak vůbec - nachystané stopy
 * samy o sobě nejsou zpráva a v seznamu by z toho byl les šedých sluchátek.
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

function Sluchatka({ velikost }: { velikost: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={velikost}
      height={velikost}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Oblouk přes hlavu a dvě mušle - poznatelné i ve dvanácti pixelech. */}
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="2.5" y="13.5" width="4" height="6.5" rx="1.6" />
      <rect x="17.5" y="13.5" width="4" height="6.5" rx="1.6" />
    </svg>
  );
}

function popis(stav: StavPreposlechu, hotovo: boolean): string {
  const casti: string[] = [];
  if (stav.chyb > 0) casti.push(`${stav.chyb} zapsaných chyb`);
  if (stav.stop > 0) casti.push(`${stav.poslechnuto} z ${stav.stop} stop doposlechnuto`);
  if (typeof stav.procent === 'number') casti.push(`${stav.procent} % textu`);
  const detail = casti.length ? ` — ${casti.join(' · ')}` : '';
  return `${hotovo ? 'Přeposlechnuto komplet' : 'Přeposlech běží'}${detail}`;
}

export function OdznakPreposlechu({
  stav,
  /** `tecka` je kolečko k ikoně typu v přehledu, `odznak` je pruh s textem do detailu. */
  varianta = 'tecka',
}: {
  stav: StavPreposlechu | null | undefined;
  varianta?: 'tecka' | 'odznak';
}) {
  if (!stav) return null;
  const hotovo = stav.hotovo;
  const bezi = !hotovo && stav.chyb > 0;
  if (!hotovo && !bezi) return null;

  const titulek = popis(stav, hotovo);

  if (varianta === 'tecka') {
    return (
      <span
        title={titulek}
        aria-label={titulek}
        className={`grid place-items-center w-[15px] h-[15px] rounded-full ${
          hotovo ? 'bg-okTint text-status-done' : 'bg-warnTint text-status-progress'
        }`}
      >
        <Sluchatka velikost={10} />
      </span>
    );
  }

  return (
    <span
      title={titulek}
      aria-label={titulek}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 font-heading text-xs font-semibold whitespace-nowrap ${
        hotovo
          ? 'bg-okTint text-status-done border-status-done/30'
          : 'bg-warnTint text-status-progress border-status-progress/30'
      }`}
    >
      <Sluchatka velikost={13} />
      {hotovo ? 'Přeposlechnuto' : `Přeposlech běží · ${stav.chyb}`}
    </span>
  );
}
