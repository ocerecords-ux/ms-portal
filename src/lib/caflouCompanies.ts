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

/**
 * Odhad, jestli je zaznam z Caflou klient, nebo herec (zadani 8. 9. 2026:
 * "nemuzes to natahnout najednou?").
 *
 * Poradi je zamerne takove, ze se nejdriv zkusi POLE Z CAFLOU a teprve kdyz
 * zadne neni, hada se z nazvu. Herec je pro Mediaspace dodavatel (fakturuje
 * nam), klient je odberatel - kdyz Caflou tohle rozliseni vede, je to
 * spolehlivejsi nez jakykoliv odhad.
 *
 * Co si odhad neni jisty, zustane NEZARAZENO - radeji par radku k rucnimu
 * projiti nez herec omylem zalozeny mezi firmami.
 */
// Pravni formy se hledaji az v nazvu BEZ DIAKRITIKY a vzdy oddelene mezerou
// nebo teckou. Bez toho to strilelo vedle: JavaScriptove \b bere "í" jako
// nepismeno, takze uvnitr "Písařík" naslo hranici slova kolem "sa" a herec
// Martin Pisarik vysel jako firma s pravni formou "s.a.".
const LEGAL_FORM =
  /(^|[\s,.()\-])(s\.?\s?r\.?\s?o|a\.?\s?s|v\.?\s?o\.?\s?s|z\.?\s?s|o\.?\s?p\.?\s?s|spol|ltd|limited|llc|inc|gmbh|kft|sp\.?\s?z\.?\s?o\.?\s?o)([\s,.()\-]|$)/;

const COMPANY_WORDS =
  /(media|publishing|books|knih|nakladatel|vydavatel|group|studi|records|music|audio|agentur|agency|company|productio|produkc|holding|invest|trade|servis|service|centrum|institut|skol|universi|univerz|mesto|obec|kraj|urad)/;

/** Akademicke tituly - kdyz je nazev nese, jde skoro jiste o cloveka. */
const TITLES = /(^|\s)(mgr|ing|mga|bc|bca|phdr|paeddr|judr|mudr|rndr|doc|prof|dis)\.?(\s|$)/;

/** Nazev bez diakritiky a v malych pismenech - jen pro porovnavani. */
function bezDiakritiky(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Vypada nazev jako jmeno cloveka? Dve az tri slova, kazde zacina velkym
 * pismenem a neobsahuje cislici. Prvni pismeno testujeme pres toUpperCase,
 * ne rozsahem znaku - "Č" ani "Ř" v zadnem jednoduchem rozsahu neleze.
 */
function vypadaJakoJmeno(name: string): boolean {
  const slova = name.trim().split(/\s+/).filter(Boolean);
  if (slova.length < 2 || slova.length > 3) return false;
  return slova.every((slovo) => {
    if (slovo.length < 2 || /[\d]/.test(slovo)) return false;
    const prvni = slovo.charAt(0);
    return prvni !== prvni.toLowerCase() && prvni === prvni.toUpperCase();
  });
}

export function guessContactKind(
  mapped: MappedCaflouCompany,
  raw: any,
): { kind: CaflouContactKind; reason: string } {
  // 1) Pole primo z Caflou.
  const boolOf = (keys: string[]): boolean | null => {
    for (const key of keys) {
      const value = raw?.[key];
      if (value === true || value === 1 || value === '1') return true;
      if (value === false || value === 0 || value === '0') return false;
    }
    return null;
  };
  const textOf = (keys: string[]): string => (pickString(raw, keys) ?? '').toLowerCase();

  if (boolOf(['is_person', 'person', 'is_individual']) === true) {
    return { kind: 'HEREC', reason: 'V Caflou je vedený jako osoba.' };
  }
  const typ = textOf(['type', 'company_type', 'contact_type', 'category', 'kind']);
  if (typ.includes('klient') || typ.includes('customer') || typ.includes('odberatel')) {
    return { kind: 'KLIENT', reason: `Pole „${typ}" v Caflou.` };
  }
  if (typ.includes('dodavatel') || typ.includes('supplier') || typ.includes('vendor')) {
    return { kind: 'HEREC', reason: `Pole „${typ}" v Caflou (dodavatel = fakturuje nám).` };
  }
  const jeOdberatel = boolOf(['is_customer', 'customer', 'is_client', 'client']);
  const jeDodavatel = boolOf(['is_supplier', 'supplier', 'is_vendor', 'vendor']);
  if (jeOdberatel === true && jeDodavatel !== true) {
    return { kind: 'KLIENT', reason: 'V Caflou označený jako odběratel.' };
  }
  if (jeDodavatel === true && jeOdberatel !== true) {
    return { kind: 'HEREC', reason: 'V Caflou označený jako dodavatel.' };
  }

  // 2) Odhad z nazvu.
  const name = mapped.name.trim();
  const porovnatelny = bezDiakritiky(name);
  if (LEGAL_FORM.test(porovnatelny)) return { kind: 'KLIENT', reason: 'Právní forma v názvu.' };
  if (COMPANY_WORDS.test(porovnatelny)) return { kind: 'KLIENT', reason: 'Název vypadá na firmu.' };
  if (TITLES.test(porovnatelny)) return { kind: 'HEREC', reason: 'Akademický titul v názvu.' };
  if (vypadaJakoJmeno(name)) return { kind: 'HEREC', reason: 'Vypadá to na jméno osoby.' };

  return { kind: 'NEZARAZENO', reason: 'Nepodařilo se rozhodnout — vyberte ručně.' };
}
