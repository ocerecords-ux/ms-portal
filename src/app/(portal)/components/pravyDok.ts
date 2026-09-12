'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Kdo právě drží pravou hranu obrazovky (zadání 10. 9. 2026: „ten To-do list
 * je strašně krátký na délku a člověk v tom musí rolovat").
 *
 * Úkoly a chat se dřív dělily o pravou hranu — úkoly nahoře, chat dole — a
 * aby na sebe nelezly, měly obě zastropovanou výšku (úkoly 24 % obrazovky).
 * Teď jsou z nich záložky JEDNOHO panelu: otevřený je vždycky jen jeden a
 * dostane celou výšku od horní lišty po spodek okna. Přepíná se záložkami
 * v hlavičce panelu, takže cesta z úkolů do chatu je jedno kliknutí.
 *
 * Stav si pamatuje prohlížeč a rozesílá se událostí, protože oba panely jsou
 * samostatné komponenty vedle sebe v layoutu — jeden o druhém jinak neví.
 */

export type OtevrenyDok = 'ukoly' | 'chat' | null;

const KLIC = 'ms-portal-pravy-dok';
const UDALOST = 'ms-portal-pravy-dok';

/** Klice z doby, kdy si kazdy panel pamatoval otevreni sam. */
const STARY_KLIC_UKOLY = 'ms-portal-ukoly-otevreno';
const STARY_KLIC_CHAT = 'ms-portal-chat-otevreno';

function precti(): OtevrenyDok {
  try {
    const ulozene = window.localStorage.getItem(KLIC);
    if (ulozene === 'ukoly' || ulozene === 'chat') return ulozene;
    if (ulozene === 'nic') return null;
    // Prvni nacteni po zmene: kdo byl otevreny driv, ten zustane otevreny.
    if (window.localStorage.getItem(STARY_KLIC_CHAT) === '1') return 'chat';
    if (window.localStorage.getItem(STARY_KLIC_UKOLY) === '1') return 'ukoly';
    return null;
  } catch {
    // Soukrome okno nebo zakazane uloziste - panel proste zacne zabaleny.
    return null;
  }
}

/**
 * Vrátí, co je otevřené, a funkci na přepnutí. Zavolání se okamžitě promítne
 * do všech ostatních panelů na stránce.
 */
export function usePravyDok(): [OtevrenyDok, (dok: OtevrenyDok) => void] {
  // Server ani prvni vykresleni nesmi sahat na localStorage, jinak by se
  // serverova a klientska podoba stranky lisily - proto az v efektu.
  const [dok, setDok] = useState<OtevrenyDok>(null);

  useEffect(() => {
    setDok(precti());
    const posluchac = (e: Event) => setDok((e as CustomEvent<OtevrenyDok>).detail ?? null);
    window.addEventListener(UDALOST, posluchac);
    return () => window.removeEventListener(UDALOST, posluchac);
  }, []);

  const otevri = useCallback((novy: OtevrenyDok) => {
    setDok(novy);
    try {
      window.localStorage.setItem(KLIC, novy ?? 'nic');
    } catch {
      // nevadi
    }
    window.dispatchEvent(new CustomEvent<OtevrenyDok>(UDALOST, { detail: novy }));
  }, []);

  return [dok, otevri];
}

// --- Počty v záložkách -----------------------------------------------------
// Úkoly znají počet otevřených úkolů, chat počet nepřečtených zpráv - a každý
// z nich potřebuje ukázat i to číslo toho druhého. Posílají si je přes stejnou
// událost, takže nikdo nemusí načítat data, která už má vedle něj někdo jiný.

type PoctyDoku = { ukoly?: number; chat?: number; poTerminu?: number };

const UDALOST_POCTY = 'ms-portal-pravy-dok-pocty';

let posledniPocty: PoctyDoku = {};

export function oznamPocetDoku(klic: keyof PoctyDoku, hodnota: number) {
  if (posledniPocty[klic] === hodnota) return;
  posledniPocty = { ...posledniPocty, [klic]: hodnota };
  window.dispatchEvent(new CustomEvent<PoctyDoku>(UDALOST_POCTY, { detail: posledniPocty }));
}

export function usePoctyDoku(): PoctyDoku {
  const [pocty, setPocty] = useState<PoctyDoku>({});

  useEffect(() => {
    setPocty(posledniPocty);
    const posluchac = (e: Event) => setPocty((e as CustomEvent<PoctyDoku>).detail ?? {});
    window.addEventListener(UDALOST_POCTY, posluchac);
    return () => window.removeEventListener(UDALOST_POCTY, posluchac);
  }, []);

  return pocty;
}

// --- Nepřečtené rozhovory vedle poutka ------------------------------------
//
// Zadání 12. 9. 2026: „chtěl bych v chatu ještě nastavit, aby se tady nalevo
// od toho panelu objevily ty uživatele nebo skupiny jako notifikace a můžu na
// ně kliknout a prokliknout se rovnou na danou konverzaci. Pak to samozřejmě
// zmizí, až se prokliknu. Kolečka bych asi řadil pod sebou."
//
// Číslo u poutka říkalo jen KOLIK zpráv čeká, ne OD KOHO — a otevřít je
// znamenalo rozbalit panel a hledat v seznamu. Tváře vedle poutka odpovídají
// na obojí a jsou zároveň zkratkou dovnitř.
//
// Data posílá ChatDock, který je stejně načítá i zabalený. Ležela by tu jinak
// druhá kopie stejného dotazu.

export type NeprectenaKonverzace = {
  id: string;
  label: string;
  avatarUrl: string | null;
  unread: number;
  kind: string;
};

const UDALOST_NEPRECTENE = 'ms-portal-neprectene-rozhovory';
const UDALOST_OTEVRI = 'ms-portal-otevri-rozhovor';

let posledniNeprectene: NeprectenaKonverzace[] = [];

export function oznamNeprectene(seznam: NeprectenaKonverzace[]) {
  const stejne =
    posledniNeprectene.length === seznam.length &&
    posledniNeprectene.every((c, i) => c.id === seznam[i].id && c.unread === seznam[i].unread);
  if (stejne) return;
  posledniNeprectene = seznam;
  window.dispatchEvent(new CustomEvent<NeprectenaKonverzace[]>(UDALOST_NEPRECTENE, { detail: seznam }));
}

export function useNeprectene(): NeprectenaKonverzace[] {
  const [seznam, setSeznam] = useState<NeprectenaKonverzace[]>([]);

  useEffect(() => {
    setSeznam(posledniNeprectene);
    const posluchac = (e: Event) => setSeznam((e as CustomEvent<NeprectenaKonverzace[]>).detail ?? []);
    window.addEventListener(UDALOST_NEPRECTENE, posluchac);
    return () => window.removeEventListener(UDALOST_NEPRECTENE, posluchac);
  }, []);

  return seznam;
}

/** Otevře panel a v něm rovnou tenhle rozhovor. */
export function otevriRozhovor(id: string) {
  window.dispatchEvent(new CustomEvent<string>(UDALOST_OTEVRI, { detail: id }));
}

export function usePosluchacOtevreni(onOtevri: (id: string) => void) {
  useEffect(() => {
    const posluchac = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) onOtevri(id);
    };
    window.addEventListener(UDALOST_OTEVRI, posluchac);
    return () => window.removeEventListener(UDALOST_OTEVRI, posluchac);
  }, [onOtevri]);
}

/**
 * Běží portál jako nainstalovaná aplikace? V ní MS chat není - má vlastní
 * aplikaci (zadání 9. 9. 2026) - takže se v panelu nenabízí a poutko na hraně
 * otevírá rovnou Úkoly.
 *
 * Pozná se to podle toho, že stránka běží ve vlastním okně bez adresního
 * řádku. Zjistit to jde až v prohlížeči, na serveru ne.
 */
export function useVAplikaci(): boolean {
  const [vAplikaci, setVAplikaci] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const samostatne =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setVAplikaci(Boolean(samostatne));
  }, []);

  return vAplikaci;
}
