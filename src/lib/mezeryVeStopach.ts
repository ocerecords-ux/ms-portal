/**
 * DÍRY V ČÍSLOVÁNÍ STOP (zadání 19. 11. 2026).
 *
 * Radka Kopecká z Audioteky nám přeposlala mail „mrkněte prosím na chybějící
 * tracky 17 - 20". Tohle si má všimnout portál dřív než klient: čísla stop
 * jsou v názvech souborů a tracklist říká, kolik jich má být.
 *
 * Modul je ZÁMĚRNĚ ČISTÝ - žádný Disk, žádná databáze. Počítá se z toho, co
 * mu kdo podá, a dá se to otestovat (tests/mezeryVeStopach.test.ts).
 *
 * DVĚ RŮZNÉ DÍRY:
 *  1. UPROSTŘED - 01, 02, 04 → chybí 03. Pozná se z řady samo.
 *  2. NA KONCI - na disku je 16 stop, v tracklistu jich je 20. Tahle díra
 *     z řady vidět NENÍ (řada končí tam, kde končí), a přitom je to přesně
 *     ten případ, na který si Audioteka stěžovala. Proto `ocekavano`.
 */

export type MezeryVeStopach = {
  /** Čísla, která v řadě chybí. Vzestupně. */
  chybi: number[];
  /** Čísla, která jsou na disku víckrát - dvě verze téhož tracku. */
  duplicity: number[];
  /** Zvukové soubory, které číslo v názvu nemají vůbec. */
  bezCisla: string[];
  /** Nejnižší a nejvyšší nalezené číslo. */
  od: number | null;
  do: number | null;
  /** Kolik očíslovaných stop na disku leží. */
  pocet: number;
};

/** Kolik očíslovaných stop musí ležet na disku, aby se vůbec soudilo. */
const PRAH = 3;

export function najdiMezery(
  stopy: { name: string; poradi: number | null }[],
  ocekavano?: number | null,
): MezeryVeStopach {
  const cisla: number[] = [];
  const bezCisla: string[] = [];
  const kolikrat = new Map<number, number>();

  for (const stopa of stopy) {
    if (stopa.poradi === null) {
      bezCisla.push(stopa.name);
      continue;
    }
    cisla.push(stopa.poradi);
    kolikrat.set(stopa.poradi, (kolikrat.get(stopa.poradi) ?? 0) + 1);
  }

  const prazdne: MezeryVeStopach = {
    chybi: [],
    duplicity: [],
    bezCisla,
    od: null,
    do: null,
    pocet: cisla.length,
  };
  if (cisla.length < PRAH) return prazdne;

  const od = Math.min(...cisla);
  const doKonce = Math.max(...cisla);
  const je = new Set(cisla);

  const chybi: number[] = [];
  /**
   * ZAČÁTEK ŘADY. Když stopy začínají od 03, chybí nejspíš 01 a 02 - ale jen
   * když je ten náskok malý. Řada, která začíná od 101, je číslování dílu,
   * ne díra po sto stopách.
   */
  if (od > 1 && od <= 4) {
    for (let i = 1; i < od; i += 1) chybi.push(i);
  }
  for (let i = od; i <= doKonce; i += 1) {
    if (!je.has(i)) chybi.push(i);
  }
  /** KONEC ŘADY - tohle z disku vidět není, musí přijít z tracklistu. */
  if (ocekavano && ocekavano > doKonce) {
    for (let i = doKonce + 1; i <= ocekavano; i += 1) chybi.push(i);
  }

  const duplicity = [...kolikrat.entries()]
    .filter(([, kolik]) => kolik > 1)
    .map(([cislo]) => cislo)
    .sort((a, b) => a - b);

  return { chybi, duplicity, bezCisla, od, do: doKonce, pocet: cisla.length };
}

/**
 * Čísla jako věta: [17,18,19,20] → „17-20", [3,17,19] → „3, 17 a 19".
 * Souvislé úseky se spojují - „chybí 17-20" se čte líp než výčet.
 */
export function vypisCisla(cisla: number[]): string {
  if (cisla.length === 0) return '';
  const serazena = [...new Set(cisla)].sort((a, b) => a - b);
  const useky: string[] = [];
  let zacatek = serazena[0];
  let predchozi = serazena[0];

  const uzavri = () => {
    if (zacatek === predchozi) useky.push(String(zacatek));
    else if (predchozi === zacatek + 1) useky.push(`${zacatek}, ${predchozi}`);
    else useky.push(`${zacatek}-${predchozi}`);
  };

  for (const cislo of serazena.slice(1)) {
    if (cislo === predchozi + 1) {
      predchozi = cislo;
      continue;
    }
    uzavri();
    zacatek = cislo;
    predchozi = cislo;
  }
  uzavri();

  if (useky.length === 1) return useky[0];
  return `${useky.slice(0, -1).join(', ')} a ${useky[useky.length - 1]}`;
}

/** Je na co upozorňovat? Soubory bez čísla samy o sobě poplach nejsou. */
export function jeNaCoUpozornit(m: MezeryVeStopach): boolean {
  return m.chybi.length > 0 || m.duplicity.length > 0;
}

/**
 * Otisk nálezu. Podle něj se pozná, že se od minule nic nezměnilo a nemá se
 * tedy křičet podruhé na to samé.
 */
export function otiskMezer(m: MezeryVeStopach): string {
  return `chybi:${m.chybi.join(',')}|dupl:${m.duplicity.join(',')}`;
}
