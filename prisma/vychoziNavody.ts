import { MAPA_PORTALU } from './navodMapaPortalu';
import { POZVANKA_HERCE } from './navodPozvankaHerce';
import { AUDIOTAGGER } from './navodAudiotagger';
import { STAVY_A_DOTOCENO } from './navodStavyDotoceno';
import { REKLAMY_PRIPOMINKY } from './navodReklamyPripominky';
import { NAHLEDOVY_UCET } from './navodNahledovyUcet';
import { NATACECI_TERMINY } from './navodNataceciTerminy';
import { ODBER_KALENDARE } from './navodOdberKalendare';
import { KLIENT_PORTAL } from './navodProKlientyPortal';
import { KLIENT_OBJEDNAVKA } from './navodProKlientyObjednavka';
import { KLIENT_PREPOSLECH } from './navodProKlientyPreposlech';
import { KLIENT_REKLAMA } from './navodProKlientyReklama';
import { STUDIO_BOOKING } from './navodStudioBooking';

/**
 * NÁVODY, KTERÉ PORTÁL ZALOŽÍ SÁM (zadání 16. 9. 2026: „udělejme nějakou
 * přehlednou sekci a tam budeme vše postupně přidávat").
 *
 * Nový návod se sem přidá jedním řádkem. Zakládají se JEN JEDNOU - jakmile
 * někdo návod v portálu upraví, seed už do něj nesahá, jinak by každé
 * nasazení přepsalo, co člověk napsal.
 */
export type VychoziNavod = {
  slug: string;
  nazev: string;
  perex: string;
  kategorie: string;
  poradi: number;
  obsah: string;
  /**
   * PRO KOHO NÁVOD JE (zadání 23. 9. 2026: „klienti by měli vidět nápovědu
   * ve svém přístupu na věci, ke kterým mají přístup").
   *
   * Prázdné (a chybějící) znamená CELÝ TÝM - Žůžo-labůžo, produkce a zvukař;
   * klient ani herec takový návod nevidí. Návod psaný klientovi musí mít
   * ['CLIENT'], jinak se k němu nedostane. Viz vidiNavod v lib/navody.ts.
   */
  proRole?: string[];
  /**
   * PRO JAKY DRUH ZAKAZEK (zadani 24. 9. 2026: „je treba rozlisit dva druhy -
   * pro audioknihy a pro reklamy, podle toho by se i navody mely objevovat
   * klientovi").
   *
   * 'AUDIOBOOK' | 'AD'; prazdne (a chybejici) = pro obojí. Rozhoduje to jen
   * u klienta, a to podle Druhu zakazek na karte jeho firmy.
   */
  proDruhy?: string[];
};

export const VYCHOZI_NAVODY: VychoziNavod[] = [
  // Mapa portalu je uvod pro kazdeho, kdo portal otevre poprve (18. 9. 2026).
  MAPA_PORTALU,
  POZVANKA_HERCE,
  STAVY_A_DOTOCENO,
  AUDIOTAGGER,
  // Pripominkovani a schvalovani reklam (zadani 18. 9. 2026).
  REKLAMY_PRIPOMINKY,
  // Ucet na prohlizeni portalu z ruznych roli (zadani 18. 9. 2026).
  NAHLEDOVY_UCET,
  // Planovani natacecich terminu od nabidky po kalendar (zadani 19. 9. 2026).
  NATACECI_TERMINY,
  // MS kalendar v Google/Apple kalendari (zadani 20. 9. 2026).
  ODBER_KALENDARE,
  // Navody PRO KLIENTY (zadani 23. 9. 2026) - jen k tomu, kam klient sam
  // dosahne: portal, objednavka, preposlech a schvaleni.
  KLIENT_PORTAL,
  KLIENT_OBJEDNAVKA,
  // Preposlech je rozdeleny na dva druhy (24. 9. 2026: „je treba rozlisit dva
  // druhy - pro audioknihy a pro reklamy"). Klient uvidi jen ten, ktery sedi
  // na Druh zakazek jeho firmy - viz proDruhy a sediDruh v lib/navody.ts.
  KLIENT_PREPOSLECH,
  KLIENT_REKLAMA,
  // Navod pro muzikanty, kteri si bookuji studio (25. 9. 2026). Jediny
  // anglicky navod v portalu - cte ho klient MS Studio London.
  STUDIO_BOOKING,
];
