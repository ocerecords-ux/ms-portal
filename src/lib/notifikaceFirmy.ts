import type { KomuNotifikace } from '@prisma/client';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';

/**
 * Nastavení zpráv klientovi podle stavu projektu (zadání 10. 9. 2026).
 *
 * Každá firma to má jinak — Audioteka chce vědět už o prvních trackách,
 * Jota až o hotovém projektu a první dva stavy chce jen internímu týmu.
 * Proto se nastavuje u firmy, ne globálně.
 *
 * Tenhle soubor je bez Prismy (jen typ), aby si ho mohl vzít i formulář
 * v prohlížeči.
 */

export const KOMU_POPISKY: Record<KomuNotifikace, string> = {
  NIKAM: 'Neposílat',
  KLIENT: 'Klientovi',
  INTERNE: 'Jen nám interně',
};

export const KOMU_MOZNOSTI: KomuNotifikace[] = ['NIKAM', 'KLIENT', 'INTERNE'];

/**
 * Stavy, u kterých má smysl zprávu posílat.
 *
 * Ne všechny stavy z cesty projektu: „V přípravě" a „Natáčíme" znamenají, že
 * se ještě nic nestalo, a zpráva o tom by byla jen šum. Kdyby to někdy
 * potřeba bylo, stačí sem stav přidat.
 */
export const STAVY_S_NOTIFIKACI: string[] = [
  'Natáčíme/stříháme',
  // Herec dotocil a strihat se jeste nezacalo (zadani 11. 9. 2026). Nova
  // firma to ma vypnute jako vsechno ostatni - kdo o to nestoji, nic
  // nedostane.
  'Dotočeno',
  'Dotočeno/stříháme',
  'Dokončeno - ke schválení',
  'Čekáme na opravy',
  'Schváleno - k fakturaci',
];

/** Co se u kterého stavu v mailu píše - ať je vidět, co klientovi dorazí. */
export const CO_SE_POSILA: Record<string, string> = {
  'Natáčíme/stříháme': 'Na disk jsme přidali první tracky, můžete poslouchat.',
  'Dotočeno': 'S hercem je dotočeno, pustili jsme se do střihu.',
  'Dotočeno/stříháme': 'Na disk jsme přidali první tracky k poslechu.',
  'Dokončeno - ke schválení': 'Na disku jsou všechny tracky, čekáme na finální opravy.',
  'Čekáme na opravy': 'Sedm dní po odevzdání jsme nedostali opravy — připomínka.',
  'Schváleno - k fakturaci': 'Na disku jsou opravené tracky k vydání.',
};

export function popisStavuProNotifikaci(stav: string): string {
  return STAVY_PROJEKTU.find((s) => s.nazev === stav)?.popis ?? '';
}

export type NastaveniNotifikaci = Record<string, KomuNotifikace>;

/** Prázdné nastavení - co není uložené, se neposílá. */
export function prazdneNastaveni(): NastaveniNotifikaci {
  return Object.fromEntries(STAVY_S_NOTIFIKACI.map((s) => [s, 'NIKAM' as KomuNotifikace]));
}

/**
 * Předvolba podle toho, jak to má většina klientů (Audioteka, Albatros,
 * Jan Melvil, Čti mi!) - všech pět stavů klientovi. Nabízí se tlačítkem,
 * automaticky se nikde nepoužije: zprávu klientovi nemá zapnout portál sám.
 */
export function predvolbaJakoAudioteka(): NastaveniNotifikaci {
  return Object.fromEntries(STAVY_S_NOTIFIKACI.map((s) => [s, 'KLIENT' as KomuNotifikace]));
}

/** Předvolba podle Joty - první dvě zprávy jen internímu týmu. */
export function predvolbaJakoJota(): NastaveniNotifikaci {
  return Object.fromEntries(
    STAVY_S_NOTIFIKACI.map((s) => [
      s,
      (s === 'Natáčíme/stříháme' || s === 'Dotočeno/stříháme' ? 'INTERNE' : 'KLIENT') as KomuNotifikace,
    ]),
  );
}

/**
 * Výchozí interní příjemci (zadání 10. 9. 2026).
 *
 * Použijí se u firmy, která vlastní seznam vyplněný nemá — ať nová firma
 * nezůstane bez toho, aby o odeslané zprávě někdo z nás věděl.
 */
export const INTERNI_PRIJEMCI = ['helena.rychlik@mediaspace.cz', 'karolina.zborilova@mediaspace.cz'];

/**
 * Komu z nás zprávy téhle firmy chodí (zadání 10. 9. 2026: "chtěl bych
 * u přidávání notifikací mít ještě i možnosti, na koho to půjde interně
 * od nás").
 *
 * Nastavuje se na kartě firmy — každý klient má u nás na starosti někdo
 * jiný. Prázdný seznam znamená „nikdo to zvlášť neřeší", takže se použije
 * výchozí dvojice.
 */
export function interniPrijemciFirmy(ulozene: string[] | null | undefined): string[] {
  const ocistene = (ulozene ?? []).map((e) => e.trim()).filter(Boolean);
  return ocistene.length > 0 ? ocistene : [...INTERNI_PRIJEMCI];
}

/** Hrubá kontrola e-mailu - jen aby se do seznamu nedostal překlep typu "helena@". */
export function jeToEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
}
