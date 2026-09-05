import type { Role } from '@prisma/client';

/**
 * Popisky roli pouzivane v adminu. Hodnoty enumu Role (schema.prisma)
 * zustavaji zpetne kompatibilni - "ADMIN" je jen interni kod, uzivatelum se
 * ale vzdy zobrazuje jako "Zuzo-labuzi" (rozsirena prava jako admin).
 * Pristup do /admin panelu ma zatim jen role ADMIN (viz middleware.ts a
 * lib/adminGuard.ts) - Zvukar a Produkce jsou zatim jen ulozitelne role pro
 * pripravovany interni CRM, bez vlastnich opravneni v teto aplikaci.
 */
export const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'Klient',
  HEREC: 'Herec',
  DODAVATEL: 'Dodavatel',
  ADMIN: 'Žužo-labůži',
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
