import type { Role, CompanyType } from '@prisma/client';

/**
 * Popisky roli pouzivane v adminu. Hodnoty enumu Role (schema.prisma)
 * zustavaji zpetne kompatibilni - "ADMIN" je jen interni kod, uzivatelum se
 * ale vzdy zobrazuje jako "Žůžo-labůžo" (rozsirena prava jako admin; oprava
 * preklepu 5. 9. 2026 - puvodne "Žužo-labůži").
 * Pristup do /admin panelu ma zatim jen role ADMIN (viz middleware.ts a
 * lib/adminGuard.ts) - Zvukar a Produkce jsou zatim jen ulozitelne role pro
 * pripravovany interni CRM, bez vlastnich opravneni v teto aplikaci.
 *
 * DODAVATEL byla puvodne take role Uzivatele - od 5. 9. 2026 (upresneni
 * zadani) se dodavatele vedou jako Firmy (viz CompanyType nize), takze tu
 * uz neni.
 */
export const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'Klient',
  HEREC: 'Herec',
  ADMIN: 'Žůžo-labůžo',
  ZVUKAR: 'Zvukař',
  PRODUKCE: 'Produkce',
  ROBOT: 'Robot',
};

/**
 * Klientske role - vazane na firmu, vyzaduji companyId.
 * Herec od 5. 9. 2026 uz firmu nema (je to samostatna jednotka), zustava
 * proto uz jen CLIENT.
 */
export const COMPANY_ROLES: Role[] = ['CLIENT'];

/** Interni role Mediaspace - bez firmy. */
export const INTERNAL_ROLES: Role[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

/**
 * Ucty, za kterymi nestoji clovek (zadani 12. 9. 2026) - dnes Bruno.
 *
 * SCHVALNE MIMO INTERNAL_ROLES. Robot se ma objevit v seznamu lidi a psat
 * do chatu, ale nema mit pristup nikam jinam: kdyby byl "interni", otevrely
 * by se mu rovnou projekty, doklady i kalendare - a ucet, ke kteremu nikdo
 * nema heslo, je presne ten, u ktereho takova prava nechceme.
 */
export const ROBOT_ROLES: Role[] = ['ROBOT'];

export const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: 'Klientské role', roles: COMPANY_ROLES },
  { label: 'Herec', roles: ['HEREC'] },
  { label: 'Interní (Mediaspace)', roles: INTERNAL_ROLES },
  { label: 'Robot (účet bez člověka)', roles: ROBOT_ROLES },
];

/**
 * Vidi projekty ve stavu „V přípravě"? (zadání 15. 9. 2026: „zvukaři nevidí
 * projekty v přípravě, vidí je až ve chvíli, kdy se překlopí do Natáčíme").
 *
 * Projekt v přípravě je zatím jen objednávka: není domluvený termín ani herec
 * a v seznamu zvukaře by jen přibývalo něco, s čím zatím nemá co dělat.
 * Žůžo-labůžo, produkce, klienti a herci ho vidí od začátku.
 */
export function vidiProjektyVPriprave(role: Role): boolean {
  return role !== 'ZVUKAR';
}

export function roleRequiresCompany(role: Role): boolean {
  return COMPANY_ROLES.includes(role);
}

/**
 * Zalozky na strance /admin/users (zadani 5. 9. 2026): uzivatele se tam
 * netridi podle firmy, ale podle teto kategorie - Mediaspace (interni tym),
 * Klienti a Herci. Dodavatele uz tu nejsou - viz COMPANY_TYPE_TABS, presunuty
 * pod sekci Firmy.
 */
export const USER_TABS: { key: string; label: string; roles: Role[] }[] = [
  // Robot sedi v zalozce Mediaspace, at je videt, ze existuje - prava
  // s internim tymem nesdili, jen misto v seznamu.
  { key: 'mediaspace', label: 'Mediaspace', roles: [...INTERNAL_ROLES, ...ROBOT_ROLES] },
  { key: 'klienti', label: 'Klienti', roles: ['CLIENT'] },
  { key: 'herci', label: 'Herci', roles: ['HEREC'] },
];

/** Ctyri fyzicka studia, ve kterych je herec schopen natacet - zadani 5. 9. 2026. */
/**
 * LOKACE HERCE - kde je schopen fyzicky natáčet.
 *
 * Jen MĚSTA (zadání 15. 9. 2026: „místo změň na jednoduše jen Brno, Praha").
 * Do 15. 9. 2026 se tu vybíraly konkrétní studia („MS Studio - Brno II").
 * K ničemu to nebylo: pro rozhodnutí „kam ho pozvat" i pro smlouvu je
 * podstatné město, ne která místnost - a která místnost bude volná, stejně
 * rozhoduje kalendář.
 *
 * Starší zápisy se převádějí samy - viz sjednotLokaci v lib/lokaceHercu.ts.
 */
export const HEREC_STUDIOS: string[] = [
  'MS Studio - Brno I',
  'MS Studio - Brno II',
  'MS Studio - Praha',
  'MS Studio - London',
];

/** Popisky typu firmy - viz CompanyType (schema.prisma). */
export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  KLIENT: 'Klient',
  DODAVATEL: 'Dodavatel',
};

/**
 * Zalozky na strance /admin (Firmy), zadani 5. 9. 2026: Firmy se deli na
 * Klienty a Dodavatele - stejny model Company, jina zalozka podle CompanyType.
 */
export const COMPANY_TYPE_TABS: { key: string; label: string; type: CompanyType }[] = [
  { key: 'klienti', label: 'Klienti', type: 'KLIENT' },
  { key: 'dodavatele', label: 'Dodavatelé', type: 'DODAVATEL' },
];

/**
 * Interni ucet Mediaspace (Zuzo-labuzo / Produkce / Zvukar). Takovy ucet
 * nema firmu - v portalu proto misto "svych" projektu vidi prehled projektu
 * napric vsemi firmami (viz (portal)/projekty/page.tsx).
 */
export function isInternalRole(role: Role): boolean {
  return INTERNAL_ROLES.includes(role);
}

/**
 * Kdo smi menit interni atributy projektu (odkaz na KZ, manazer, priorita,
 * typ projektu - viz model ProjectMeta) - zadani 5. 9. 2026: "můžou je měnit
 * jen uživatelé typu s rolí Produkce a Žůžo-labůžo. Zvukaři je budou mít jen
 * jako náhled ke čtení."
 */
export function canEditProjectMeta(role: Role): boolean {
  return role === 'ADMIN' || role === 'PRODUKCE';
}

/**
 * Kdo smi videt doklady navazane na projekt (zadani 8. 9. 2026). Zatim jen
 * Zuzo-labuzo - samotna sekce Doklady je v /admin, kam ostatni role nemaji
 * pristup (middleware.ts), takze by z detailu projektu koukali na odkazy,
 * ktere jim stejne neotevrou.
 */
export function canViewProjectDocuments(role: Role): boolean {
  // Zvukar ani produkce sem nepatri (potvrzeno 11. 9. 2026: "zvukari by
  // nemeli videt u projektu zadne doklady ani rozpocty").
  //
  // OD 16. 9. 2026 UZ TENHLE PREPINAC NEROZHODUJE O ROZPOCTU - produkce ho
  // vidi (canViewProjectBudget vyse), doklady porad ne. Do te doby to bylo
  // jedno pravo pro oboji, takze se Helca nedostala ani k rozpoctu.
  return role === 'ADMIN';
}

/**
 * Kdo smi videt CENU NA OBJEDNAVCE (zadani 16. 9. 2026: „kdyz prijde nova
 * objednavka na audioknihu, tam by Helca, ktera ma pristup Produkce, nemela
 * videt cenu. Jen normostrany").
 *
 * Predbezna cena je obchodni udaj - co si u nas firma objednava a za kolik.
 * Produkce z objednavky potrebuje rozsah a termin, aby mohla planovat studio
 * a herce; kolik to stoji, k tomu nepotrebuje.
 *
 * ZUZO-LABUZO, NE PRODUKCE - schvalne uzsi nez canViewProjectBudget: rozpocet
 * projektu je nase vnitrni kalkulace (kolik nas to stoji), tohle je cena pro
 * klienta.
 */
export function vidiCenuObjednavky(role: Role): boolean {
  return role === 'ADMIN';
}

/**
 * Kdo smi u projektu videt ROZPOCET - cisla rozpoctu, polozkove naklady,
 * vykazy a bonusy (zadani 16. 9. 2026: „povol Helce, at vidi polozky rozpoctu
 * v detailu projektu. Nemela by videt doklady jako nabidky a faktury").
 *
 * Je to schvalne UZSI kruh nez doklady a zaroven sirsi nez driv: produkce
 * rozpocet projektu resi (ona do nej pise naklady na herce), ale k nabidkam
 * a fakturam se dostat nema - ty zustavaji na canViewProjectDocuments.
 * Zvukar nema ani jedno (zadani 11. 9. 2026).
 */
export function canViewProjectBudget(role: Role): boolean {
  return role === 'ADMIN' || role === 'PRODUKCE';
}

/**
 * Kdo smi u projektu videt obchodni udaje - klienta a datum vydani (zadani
 * 13. 9. 2026: „zvukari by u projektu nemeli videt: Datum vydani, doklady,
 * klienta").
 *
 * Zvukar dela zvuk. Koho projekt objednal a kdy titul vychazi, k tomu
 * nepotrebuje - je to obchodni informace, ne vyrobni. Firma u projektu mu
 * zustava: podle ni pozna, ci nahravku ma na stole.
 *
 * DOKLADY sem nepatri, ty uz resi canViewProjectDocuments - a ten je jeste
 * uzsi (jen Zuzo-labuzo, tedy ani produkce).
 */
export function canViewProjectBusinessInfo(role: Role): boolean {
  return role !== 'ZVUKAR';
}

/**
 * Kalendare studii a natacecí frekvence (zadani 8. 9. 2026). Nabidky terminu
 * sestavuje a rezervace potvrzuje Produkce a Zuzo-labuzo; zvukar kalendar jen
 * vidi. Herec ma vlastni, uzsi pohled - viz stranka /moje-terminy.
 *
 * Zamerne to NENI v /admin: Helca je role PRODUKCE a tu middleware do
 * administrace nepousti.
 */
export function canManageCalendar(role: Role): boolean {
  return role === 'ADMIN' || role === 'PRODUKCE';
}

export function canViewCalendar(role: Role): boolean {
  return role === 'ADMIN' || role === 'PRODUKCE' || role === 'ZVUKAR';
}

/** Kdo smi interni atributy projektu videt (vcetne zvukaru - jen ke cteni). */
export function canViewProjectMeta(role: Role): boolean {
  return isInternalRole(role);
}
