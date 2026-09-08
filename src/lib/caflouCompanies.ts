import type { CaflouContactKind } from '@prisma/client';

/**
 * Firmy z Caflou (zadani 8. 9. 2026) - mapovani syrove odpovedi a ciselnik
 * pro roztrideni na klienty a herce.
 *
 * Bez pristupu do databaze, aby to sla pouzit i klientska komponenta.
 */

export const CONTACT_KIND_OPTIONS: CaflouContactKind[] = ['NEZARAZENO', 'KLIENT', 'HEREC', 'IGNOROVAT'];

export const CONTACT_KIND_LABELS: Record<CaflouContactKind, string> = {
  NEZARAZENO: 'Nezařazeno',
  KLIENT: 'Klient',
  HEREC: 'Herec',
  IGNOROVAT: 'Nepoužívat',
};

export const CONTACT_KIND_CLASSES: Record<CaflouContactKind, string> = {
  NEZARAZENO: 'bg-[#FDF1DE] text-status-progress',
  KLIENT: 'bg-[#F1ECFF] text-brand-purpleDark',
  HEREC: 'bg-[#E3F9EC] text-status-done',
  IGNOROVAT: 'bg-[#EEF2F7] text-[#5B6472]',
};

/**
 * Prvni neprazdna hodnota z nekolika moznych nazvu pole. Presny tvar
 * odpovedi Caflou u firem nemame overeny a u projektu uz nas hadani nazvu
 * jednou stalo prazdny sloupec (custom_column_pocet_ns1), takze tu radeji
 * zkousime vic variant a cely puvodni zaznam si ukladame do sloupce `raw`.
 */
export function pickString(row: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = row?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

export type MappedCaflouCompany = {
  id: string;
  name: string;
  ic: string | null;
  dic: string | null;
  email: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  note: string | null;
};

/** Jeden syrovy zaznam firmy z Caflou. Vraci null, kdyz nema ID ani nazev. */
export function mapCaflouCompany(row: any): MappedCaflouCompany | null {
  const id = pickString(row, ['id', 'company_id', 'uuid']);
  const name = pickString(row, ['name', 'company_name', 'title']);
  if (!id || !name) return null;

  return {
    id,
    name,
    ic: pickString(row, ['ic', 'ico', 'company_number', 'registration_number', 'reg_no', 'crn']),
    dic: pickString(row, ['dic', 'vat_number', 'vat_id', 'tax_number']),
    email: pickString(row, ['email', 'contact_email', 'invoice_email']),
    phone: pickString(row, ['phone', 'telephone', 'contact_phone', 'mobile']),
    addressStreet: pickString(row, ['street', 'address', 'address_street', 'address_line_1']),
    addressCity: pickString(row, ['city', 'address_city', 'town']),
    addressZip: pickString(row, ['zip', 'postal_code', 'address_zip', 'zip_code', 'psc']),
    addressCountry: pickString(row, ['country', 'address_country', 'country_name', 'country_code']),
    note: pickString(row, ['note', 'notes', 'description', 'comment']),
  };
}

/** Nazev pro porovnavani s tim, co uz v portalu je - bez diakritiky, pravni formy a interpunkce. */
export function comparableCompanyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?\s?r\.?\s?o|a\.?\s?s|spol|z\.?\s?s|o\.?\s?p\.?\s?s|ltd|llc|inc|gmbh)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}
