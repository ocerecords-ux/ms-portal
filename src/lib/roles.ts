import type { Role } from '@prisma/client';

/**
 * Popisky roli pouzivane v adminu. Hodnoty enumu Role (schema.prisma)
 * zustavaji zpetne kompatibilni - "ADMIN" je jen interni kod, uzivatelum se
 * ale vzdy zobrazuje jako "Žůžo-labůžo" (rozsirena prava jako admin; oprava
 * preklepu 5. 9. 2026 - puvodne "Žužo-labůži").
 * Pristup do /admin panelu ma zatim jen role ADMIN (viz middleware.ts a
 * lib/adminGuard.ts) - Zvukar a Produkce jsou zatim jen ulozitelne role pro
 * pripravovany interni CRM, bez vlastnich opravneni v teto aplikaci.
 */
export const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'Klient',
  HEREC: 'Herec',
  DODAVATEL: 'Dodavatel',
  ADMIN: 'Žůžo-labůžo',
  ZVUKAR: 'Zvukař',
  PRODUKCE: 'Produkce',
};

/** Klientske role - vazane na firmu, vyzaduji companyId. */
export const COMPANY_ROLES: Role[] = ['CLIENT', 'HEREC', 'DODAVATEL'];

/** Interni role MEDIA SPACE - bez firmy. */
export const INTERNAL_ROLES: Role[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

export const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: 'Klientské role', roles: COMPANY_ROLES },
  { label: 'Interní (Mediaspace)', roles: INTERNAL_ROLES },
];

export function roleRequiresCompany(role: Role): boolean {
  return COMPANY_ROLES.includes(role);
}

/**
 * Zalozky na strance /admin/users (zadani 5. 9. 2026): uzivatele se tam
 * netridi podle firmy, ale podle teto kategorie - Mediaspace (interni tym),
 * Klienti, Herci a Dodavatele jako samostatna ctvrta skupina.
 */
export const USER_TABS: { key: string; label: string; roles: Role[] }[] = [
  { key: 'mediaspace', label: 'Mediaspace', roles: INTERNAL_ROLES },
  { key: 'klienti', label: 'Klienti', roles: ['CLIENT'] },
  { key: 'herci', label: 'Herci', roles: ['HEREC'] },
  { key: 'dodavatele', label: 'Dodavatelé', roles: ['DODAVATEL'] },
];
