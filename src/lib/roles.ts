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
};

/**
 * Klientske role - vazane na firmu, vyzaduji companyId.
 * Herec od 5. 9. 2026 uz firmu nema (je to samostatna jednotka), zustava
 * proto uz jen CLIENT.
 */
export const COMPANY_ROLES: Role[] = ['CLIENT'];

/** Interni role MEDIA SPACE - bez firmy. */
export const INTERNAL_ROLES: Role[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

export const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: 'Klientské role', roles: COMPANY_ROLES },
  { label: 'Herec', roles: ['HEREC'] },
  { label: 'Interní (Mediaspace)', roles: INTERNAL_ROLES },
];

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
  { key: 'mediaspace', label: 'Mediaspace', roles: INTERNAL_ROLES },
  { key: 'klienti', label: 'Klienti', roles: ['CLIENT'] },
  { key: 'herci', label: 'Herci', roles: ['HEREC'] },
];

/** Ctyri fyzicka studia, ve kterych je herec schopen natacet - zadani 5. 9. 2026. */
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
