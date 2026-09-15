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

/**
 * Co se u kterého stavu v mailu píše.
 *
 * Od 15. 9. 2026 je to CELÉ TĚLO ZPRÁVY včetně oslovení a názvu projektu
 * (zadání: „potřebuji měnit celý ten text zprávy. Dobrý den Radko a Annie bot
 * se nedá měnit") - do té doby oslovení i titul projektu stály natvrdo v mailu
 * a nešly přepsat. „**takhle**" se v mailu vysází tučně.
 */
export const CO_SE_POSILA: Record<string, string> = {
  'Natáčíme/stříháme':
    '{osloveni}\n\n**{projekt}**\n\nNa disk jsme přidali první tracky, můžete poslouchat.',
  'Dotočeno': '{osloveni}\n\n**{projekt}**\n\nS hercem je dotočeno, pustili jsme se do střihu.',
  'Dotočeno/stříháme':
    '{osloveni}\n\n**{projekt}**\n\nNa disk jsme přidali první tracky k poslechu.',
  'Dokončeno - ke schválení':
    '{osloveni}\n\n**{projekt}**\n\nNa disku jsou všechny tracky, čekáme na finální opravy.',
  'Čekáme na opravy':
    '{osloveni}\n\n**{projekt}**\n\nSedm dní po odevzdání jsme nedostali opravy — připomínka.',
  'Schváleno - k fakturaci':
    '{osloveni}\n\n**{projekt}**\n\nNa disku jsou opravené tracky k vydání.',
};

/**
 * DRUH ZPRAVY (zadani 14. 9. 2026: „musime jeste vymyslet dva druhy
 * notifikaci. Jeden druh je pro Audioknihy a druhy pro reklamy. U reklam bych
 * to potreboval trosku jinak zformulovat a odesilaji se jen ve stavu
 * Dokonceno - ke schvaleni").
 *
 * Audiokniha projde dlouhou cestou a klient chce vedet o kazdem kroku.
 * Reklama je hotova naraz - spot bud je, nebo neni - takze zprava je jedna
 * a prijde ve chvili, kdy je co schvalovat.
 */
export type DruhNotifikace = 'AUDIOKNIHA' | 'REKLAMA';

export const DRUHY_NOTIFIKACI: DruhNotifikace[] = ['AUDIOKNIHA', 'REKLAMA'];

export const DRUH_POPISKY: Record<DruhNotifikace, string> = {
  AUDIOKNIHA: 'Audioknihy',
  REKLAMA: 'Reklamy',
};

/** Jediny stav, ve kterem u reklamy zprava odchazi. */
export const STAV_REKLAMY = 'Dokončeno - ke schválení';

export const STAVY_S_NOTIFIKACI_REKLAMA: string[] = [STAV_REKLAMY];

/**
 * PODLE CEHO SE DRUH POZNA (zadani 14. 9. 2026: „to, kdy pozna system, ze je
 * to reklama, udelejme jednoduse. Budeme se ridit zaskrtavacim polem
 * v detailu firmy").
 *
 * Jde o zaskrtavatka „Druh zakazek" na karte firmy, ktera uz existuji kvuli
 * objednavkam. Kdo dela jen reklamy, dostava reklamni zneni; kdo dela
 * audioknihy - nebo oboji - to audioknizni, protoze tam je zprav vic a
 * o zadnou se tim neprijde.
 */
export function druhNotifikaceFirmy(
  firma: { dealsAudiobooks?: boolean | null; dealsAds?: boolean | null } | null | undefined,
): DruhNotifikace {
  if (!firma) return 'AUDIOKNIHA';
  return firma.dealsAds && !firma.dealsAudiobooks ? 'REKLAMA' : 'AUDIOKNIHA';
}

/** Stavy, ve kterych se posila zprava daneho druhu. */
export function stavySNotifikaci(druh: DruhNotifikace): string[] {
  return druh === 'REKLAMA' ? STAVY_S_NOTIFIKACI_REKLAMA : STAVY_S_NOTIFIKACI;
}

/**
 * Co se u reklamy posila. Znění je jen vychozi - produkce si ho prepise
 * v Administraci → Vzory zprav, stejne jako u audioknih.
 */
export const CO_SE_POSILA_REKLAMA: Record<string, string> = {
  [STAV_REKLAMY]:
    '{osloveni}\n\n**{projekt}**\n\nspot je hotový a připravený ke schválení. Poslechněte si ho prosím a dejte nám vědět, jestli je všechno v pořádku, nebo co ještě upravit.',
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
