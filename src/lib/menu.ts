import type { Role } from '@prisma/client';

/**
 * Odkazy v horní fialové liště (zadani 6. 9. 2026, prepracovano 8. 9. 2026).
 *
 * Uprava se dela primo v liste - tri tecky vpravo, volba "Upravit" (mazani a
 * pridani zkratky) nebo "Presunout" (pretahovani poradi), jako na ploche
 * iPhonu. Zadna samostatna administracni stranka uz neni.
 *
 * KDO CO UVIDI SE NENASTAVUJE. Ridi se to pravy k dane strance - viz
 * PAGE_ACCESS nize, ktere odpovida tomu, kam kterou roli pousti middleware a
 * serverove komponenty. Admin tedy urcuje jen POradi a to, co v liste je.
 *
 * Tenhle soubor je zamerne bez pristupu do databaze - pouzivaji ho i klientske
 * komponenty (Topbar). Nacitani z databaze je v lib/menuServer.ts.
 */

import { maPristup, podlehaPristupum, sekceCesty, type KdoPristupy } from '@/lib/pristupy';

export type NavItem = { href: string; label: string };
export type MenuEntry = { id: string; label: string; href: string };

export const ALL_ROLES: Role[] = ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'];

/**
 * Kdo se dostane na kterou stranku. Musi odpovidat middleware.ts a kontrolam
 * primo ve strankach - lista jen nezobrazuje odkaz tam, kam by uzivatele
 * stejne nepustila.
 */
export const PAGE_ACCESS: Record<string, Role[]> = {
  '/projekty': ALL_ROLES,
  // Backlog - odevzdali jsme v terminu? (zadani 18. 9. 2026). Od 21. 9. 2026
  // je to zalozka Prehledu, /backlog jen presmerovava. Terminy planuje
  // a meni Zuzo-labuzo s Produkci, tem to taky patri.
  '/backlog': ['ADMIN', 'PRODUKCE'],
  '/muj-ucet': ALL_ROLES,
  // Navody k portalu (zadani 16. 9. 2026). Od 23. 9. 2026 i pro klienty
  // a herce (zadani: „klienti by meli videt napovedu ve svem pristupu na
  // veci, ke kterym maji pristup") - stranka jim ukaze JEN navody psane pro
  // jejich roli, nase interni v ni nemaji (viz vidiNavod v lib/navody.ts).
  '/napoveda': ALL_ROLES,
  // Objednavka je klientska agenda.
  '/objednavka': ['CLIENT'],
  /**
   * NAHRAVKY UZ NEJSOU JEN PRO KLIENTA (zadani 30. 9. 2026: „mame na disku
   * slozky: Klientska zona, Dokumenty, Marketing. Potrebuju, at nekteri
   * uzivatele nevidi nektere slozky").
   *
   * Do tehle sekce se od tehle chvile chodi i pro nase vlastni slozky na
   * Disku, takze uz to neni klientska agenda. Kdo zadnou slozku pridelenou
   * nema, uvidi stejnou prazdnou hlasku jako driv - odkaz v liste si kazdy
   * prida nebo odebere sam (tri tecky vpravo, „Upravit").
   */
  '/nahravky': ALL_ROLES,
  // Vykazy: zvukar svoje, Zuzo-labuzo prehled celeho tymu.
  '/vykazy': ['ADMIN', 'ZVUKAR'],
  // Kalendare studii (zadani 8. 9. 2026): Produkce a Zuzo-labuzo zapisuji,
  // zvukar jen cte. Herec ma vlastni, uzsi pohled.
  '/kalendar': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  '/moje-terminy': ['HEREC'],
  // Přehledy (zadání 20. 9. 2026: „samostatnou kategorii na hlavním panelu
  // s názvem Přehledy") - zatím Kapacita studií. Je to pohled na vytížení
  // firmy, takže Žůžo-labůžo a produkce.
  '/prehledy': ['ADMIN', 'PRODUKCE'],
  // Honorare herce - navrhnuto / ceka na proplaceni / zaplaceno (19. 9. 2026).
  '/honorare': ['HEREC'],
  // Pozvanky hercu (zadani 16. 9. 2026: „tohle tlacitko musi mit zaple
  // Zuzo-labuzo i Helca - produkce"). Administrace je jen pro ADMIN,
  // proto samostatna stranka i pro Produkci.
  '/pozvanky': ['ADMIN', 'PRODUKCE'],
  // Administrace - jen Zuzo-labuzo.
  '/admin': ['ADMIN'],
  // Firmy z Caflou uz nejsou v menu (odpojeni 11. 9. 2026), stranka ale
  // zustava - je to posledni cesta, jak neco z Caflou dohledat.
  '/admin/caflou-firmy': ['ADMIN'],
  '/admin/vzory-zprav': ['ADMIN'],
  // Nastaveni sekci pod ozubenym kolem (28. 9. 2026) - viz lib/nastaveniSekci.ts.
  // Procesy - nase pracovni postupy (28. 9. 2026). Cte je cely tym, pise
  // je Zuzo-labuzo; kdo co uvidi, rozhoduje clanek sam (proRole).
  '/procesy': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  '/admin/procesy': ['ADMIN'],
  '/admin/nastaveni/projekty': ['ADMIN'],
  '/admin/nastaveni/doklady': ['ADMIN'],
  '/admin/vzory-nataceni': ['ADMIN'],
  '/admin/zpravy-portalu': ['ADMIN'],
  '/admin/users': ['ADMIN'],
  '/admin/ceniky': ['ADMIN'],
  '/admin/studia': ['ADMIN'],
  '/admin/doklady': ['ADMIN'],
  '/admin/archiv': ['ADMIN'],
  // Site - priprava prispevku na Instagram a LinkedIn (zadani 27. 9. 2026:
  // „zatim uvidim jen ja"). Role je jen prvni zamek; druhy je priznak
  // vidiSite na karte uzivatele, ktery kontroluje samotna stranka.
  '/site': ['ADMIN'],
  // Palubovka - budiky, podle kterych Ondrej ridi firmu (zadani 27. 9. 2026:
  // „vidim jen ja"). Role je jen prvni zamek; druhy je priznak vidiPalubovku
  // na karte uzivatele, ktery kontroluje sama stranka.
  '/palubovka': ['ADMIN'],
  '/prehledy/palubovka': ['ADMIN'],
  // Co Bruno vi o nasi praci (zadani 16. 9. 2026).
  '/admin/bruno': ['ADMIN'],
  '/admin/navody': ['ADMIN'],
  // Technicke parametry vyroby (zadani 27. 9. 2026: „menit to muzu hromadne
  // ja nebo Peter. Ostatni zvukari by to nemeli mit moznost upravovat").
  // Sprava je v administraci; zvukar parametry vidi v karte projektu a v chatu,
  // kde na ne nesaha. Druhy zamek je priznak spravujeTechParametry na karte -
  // bez nej je i tahle stranka jen ke cteni.
  '/admin/technicke-parametry': ['ADMIN'],
  // Zadosti o udaje hercu a firem odkazem (zadani 16. 9. 2026).
  '/admin/udaje': ['ADMIN'],
  // Tabule ve studiu v liště (zadání 23. 9. 2026: „dej jim ty tabule na horní
  // lištu přímo"). Odkaz se do lišty přidá jen tomu, kdo má na kartě
  // zaškrtnutý přístup - viz layout portálu; tohle je jen kontrola role.
  '/tabule/moje': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  // Kalendář rezervací studia (25. 9. 2026). Odkaz dostane jen ten, kdo
  // nějaké studio s rezervacemi spravuje - viz seStudiem v menuServer.ts;
  // tohle je jen kontrola role, jako u Tabule.
  '/studio': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
  // Ceník studia (28. 9. 2026). Role je jen hrubé síto - kdo na ceník
  // opravdu smí, rozhoduje smiSpravovatCenik v lib/studioCenikServer.ts
  // (Žůžo-labůžo všude, vedoucí pobočky ve svém studiu). Zvukař je v seznamu
  // právě kvůli vedoucím poboček; komu žádné studio nepatří, toho stránka
  // pošle zpátky na projekty a odkaz na ni nikde nevidí.
  '/cenik-studia': ['ADMIN', 'PRODUKCE', 'ZVUKAR'],
};

/** Uvidi uzivatel s touhle roli tenhle odkaz? Vlastni odkaz vidi kazdy. */
export function canSee(href: string, role: Role, kdo?: KdoPristupy): boolean {
  /**
   * ZAŠKRTÁVÁTKA MAJÍ PŘEDNOST (zadání 28. 9. 2026). U devíti sekcí
   * z lib/pristupy.ts rozhoduje seznam na kartě uživatele, ne role - proto se
   * ptáme nejdřív na ně. Volající, který `kdo` nepředá, se chová jako dřív;
   * takových míst má v portálu postupně ubývat.
   */
  if (kdo && podlehaPristupum(role)) {
    const sekce = sekceCesty(href);
    if (sekce) return maPristup({ ...kdo, role }, sekce);
  }
  const allowed = PAGE_ACCESS[href];
  return allowed ? allowed.includes(role) : true;
}

/** Vychozi obsah listy - odpovida stavu pred zavedenim editace. */
export const DEFAULT_MENU_ITEMS: { label: string; href: string; sortOrder: number }[] = [
  { label: 'Projekty', href: '/projekty', sortOrder: 10 },
  { label: 'Objednávka', href: '/objednavka', sortOrder: 20 },
  { label: 'Nahrávky', href: '/nahravky', sortOrder: 30 },
  { label: 'Výkazy', href: '/vykazy', sortOrder: 40 },
  { label: 'Kalendář', href: '/kalendar', sortOrder: 45 },
  { label: 'Přehledy', href: '/prehledy', sortOrder: 48 },
  { label: 'Moje termíny', href: '/moje-terminy', sortOrder: 46 },
  { label: 'Honoráře', href: '/honorare', sortOrder: 47 },
  { label: 'Firmy', href: '/admin', sortOrder: 50 },
  { label: 'Uživatelé', href: '/admin/users', sortOrder: 60 },
  { label: 'Ceníky', href: '/admin/ceniky', sortOrder: 70 },
  { label: 'Doklady', href: '/admin/doklady', sortOrder: 80 },
];

/** Stranky, ktere jde pridat zpet do listy pres "+" v rezimu Upravit. */
export const PORTAL_PAGES: { href: string; label: string }[] = [
  /**
   * CO SE DÁ PŘIDAT ZPÁTKY DO LIŠTY (zadání 28. 9. 2026: „tady z tohodle
   * výběru nech jen Výkazy, ostatní věci je zbytečné mít možnost tam
   * přidávat").
   *
   * Nabídka pod „+ Přidat stránku" se dřív rovnala seznamu všech stránek
   * portálu - včetně Archivu, Bruna, Návodů nebo Technických parametrů, kam
   * člověk jde jednou za půl roku z administrace. V liště, kde je místo na
   * deset odkazů, nemá smysl je nabízet.
   *
   * ZŮSTÁVAJÍ JEN HLAVNÍ SEKCE, tedy to, co v liště normálně je a co si
   * člověk může omylem odebrat, plus Výkazy a Procesy. Zbytek se otevírá
   * odkazem z administrace nebo z Nápovědy.
   */
  { href: '/projekty', label: 'Projekty' },
  { href: '/objednavka', label: 'Objednávka' },
  { href: '/nahravky', label: 'Nahrávky' },
  { href: '/vykazy', label: 'Výkazy' },
  { href: '/kalendar', label: 'Kalendář' },
  { href: '/prehledy', label: 'Přehledy' },
  { href: '/moje-terminy', label: 'Moje termíny' },
  { href: '/honorare', label: 'Honoráře' },
  // Procesy - nase pracovni postupy (28. 9. 2026).
  { href: '/procesy', label: 'Procesy' },
  { href: '/admin', label: 'Firmy' },
  { href: '/admin/users', label: 'Uživatelé' },
  { href: '/admin/ceniky', label: 'Ceníky' },
  { href: '/admin/studia', label: 'Studia' },
  { href: '/admin/doklady', label: 'Doklady' },
];

/** Vychozi (napevno zadana) navigace pro danou roli. */
export function defaultNavFor(role: Role): NavItem[] {
  return DEFAULT_MENU_ITEMS.filter((i) => canSee(i.href, role))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ href: i.href, label: i.label }));
}

/** Odkaz mimo portal (vlastni URL) se otevira jako obycejny <a>. */
/** Odkaz na tabuli v liště - přidává se jen komu ji admin povolil. */
export const TABULE_ITEM: NavItem = { href: '/tabule/moje', label: 'Tabule' };

/**
 * Kalendář rezervací studia v liště (zadání 25. 9. 2026: „měl by mít
 * nastavený i odkaz Studia na hlavním panelu"). Jednotné číslo schválně -
 * „Studia" v administraci jsou nastavení poboček, tohle je jejich kalendář.
 */
export const STUDIO_ITEM: NavItem = { href: '/studio', label: 'Studio' };

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
