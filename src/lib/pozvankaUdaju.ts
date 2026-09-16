import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { codePrefixForRole, nextCode } from '@/lib/codes';
import { notifyMany } from '@/lib/notifications';
import { kodZeme } from '@/lib/countries';

/**
 * ŽÁDOST O ÚDAJE ODKAZEM (zadání 16. 9. 2026: „potřebuji vymyslet nějaký
 * systém, kdy budeme hercům nebo firmám — každý zvlášť — posílat odkaz, na
 * kterém bude formulář, kde vyplní své údaje. Jméno, datum narození apod.
 * U firem IČ, tam jim to dovolí vyhledat z databáze ARES. Prostě pošleme
 * odkaz a když ho vyplní, tak se nám to automaticky propíše do systému
 * a zahlásí Karolíně").
 *
 * PROČ TO VŮBEC JE: údaje herců a dodavatelů jsme do teď opisovali z mailů,
 * esemesek a papírků. Opisování je místo, kde vzniká překlep v čísle účtu
 * a kde se ztratí hodina. Tady si je člověk vyplní sám a rovnou na svém
 * telefonu.
 *
 * JAK SE TO ZAPÍŠE (rozhodnuto 16. 9. 2026):
 *  - Kdo v portálu ještě NENÍ, založí se rovnou. Není co přepsat.
 *  - U toho, kdo v portálu UŽ JE, se čeká na odkliknutí — ale jen u polí,
 *    která už vyplněná byla. Prázdné pole se doplní samo; přepsat ověřené
 *    číslo účtu je přesně to, čím se podvádí, a to nesmí projít samo.
 *
 * ODKAZ JE OTEVŘENÝ, stejně jako podpis smlouvy: žádné přihlašování, žádný
 * kód do SMS. Jediné, co žádost identifikuje, je token — proto je dlouhý
 * a má omezenou platnost.
 */

/** Jak dlouho odkaz platí. Měsíc je dost i na člověka, který si ho nechá ležet. */
export const PLATNOST_DNI = 30;

export type DruhPozvanky = 'HEREC' | 'FIRMA';

/** Co se dá ve formuláři vyplnit. Klíče odpovídají sloupcům v databázi. */
export type VyplneneUdaje = Record<string, string | boolean | string[] | null>;

export type PolePozvanky = {
  klic: string;
  popisek: string;
  typ: 'text' | 'datum' | 'ano-ne' | 'zeme' | 'studia';
};

/**
 * Pole formuláře herce (rozhodnuto 16. 9. 2026: „jméno, datum narození,
 * adresa, kontakt, číslo účtu, IČ a DIČ, jestli je plátce DPH nebo ne
 * a ještě lokaci — studio, kde může natáčet").
 */
export const POLE_HERCE: PolePozvanky[] = [
  { klic: 'name', popisek: 'Jméno a příjmení', typ: 'text' },
  { klic: 'birthDate', popisek: 'Datum narození', typ: 'datum' },
  { klic: 'birthNumber', popisek: 'Rodné číslo', typ: 'text' },
  { klic: 'phone', popisek: 'Telefon', typ: 'text' },
  { klic: 'email', popisek: 'E-mail', typ: 'text' },
  { klic: 'addressStreet', popisek: 'Ulice a č. p.', typ: 'text' },
  { klic: 'addressCity', popisek: 'Město', typ: 'text' },
  { klic: 'addressZip', popisek: 'PSČ', typ: 'text' },
  { klic: 'addressCountry', popisek: 'Země', typ: 'zeme' },
  { klic: 'bankAccount', popisek: 'Číslo účtu', typ: 'text' },
  { klic: 'ic', popisek: 'IČ', typ: 'text' },
  { klic: 'dic', popisek: 'DIČ', typ: 'text' },
  { klic: 'vatPayer', popisek: 'Plátce DPH', typ: 'ano-ne' },
  { klic: 'studioLocations', popisek: 'Kde může natáčet', typ: 'studia' },
];

/** Pole formuláře firmy. IČ se dá načíst z ARESu a zbytek se doplní samo. */
export const POLE_FIRMY: PolePozvanky[] = [
  { klic: 'name', popisek: 'Název firmy', typ: 'text' },
  { klic: 'ic', popisek: 'IČ', typ: 'text' },
  { klic: 'dic', popisek: 'DIČ', typ: 'text' },
  { klic: 'vatPayer', popisek: 'Plátce DPH', typ: 'ano-ne' },
  { klic: 'addressStreet', popisek: 'Ulice a č. p.', typ: 'text' },
  { klic: 'addressCity', popisek: 'Město', typ: 'text' },
  { klic: 'addressZip', popisek: 'PSČ', typ: 'text' },
  { klic: 'addressCountry', popisek: 'Země', typ: 'zeme' },
  { klic: 'bankAccount', popisek: 'Číslo účtu', typ: 'text' },
  { klic: 'contactName', popisek: 'Kontaktní osoba', typ: 'text' },
  { klic: 'contactEmail', popisek: 'E-mail', typ: 'text' },
  { klic: 'contactPhone', popisek: 'Telefon', typ: 'text' },
];

export function poleProDruh(druh: DruhPozvanky): PolePozvanky[] {
  return druh === 'HEREC' ? POLE_HERCE : POLE_FIRMY;
}

/** Token je jediný klíč od formuláře - proto je dlouhý a náhodný. */
function novyToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function vytvorPozvanku(vstup: {
  druh: DruhPozvanky;
  userId?: string | null;
  companyId?: string | null;
  jmeno?: string | null;
  email?: string | null;
  poznamka?: string | null;
  vytvorilId: string;
}) {
  const platiDo = new Date();
  platiDo.setDate(platiDo.getDate() + PLATNOST_DNI);

  return prisma.pozvankaUdaju.create({
    data: {
      token: novyToken(),
      druh: vstup.druh,
      userId: vstup.userId || null,
      companyId: vstup.companyId || null,
      jmeno: vstup.jmeno?.trim() || null,
      email: vstup.email?.trim() || null,
      poznamka: vstup.poznamka?.trim() || null,
      vytvorilId: vstup.vytvorilId,
      platiDo,
    },
  });
}

/**
 * Žádost podle tokenu — jen ta, která se ještě dá vyplnit.
 *
 * Zrušená ani prošlá žádost formulář neotevře; už zapsaná taky ne, jinak by se
 * dal jedním odkazem přepisovat účet donekonečna.
 */
export async function najdiPlatnou(token: string) {
  const p = await prisma.pozvankaUdaju.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
  });
  if (!p) return null;
  if (p.stav === 'ZRUSENA') return null;
  if (p.platiDo.getTime() < Date.now()) return null;
  return p;
}

/** Co už v portálu je — proti tomu se porovnává, co člověk vyplnil. */
async function soucasneUdaje(p: { druh: string; userId: string | null; companyId: string | null }) {
  if (p.druh === 'HEREC' && p.userId) {
    return prisma.user.findUnique({ where: { id: p.userId } });
  }
  if (p.druh === 'FIRMA' && p.companyId) {
    return prisma.company.findUnique({ where: { id: p.companyId } });
  }
  return null;
}

/** Hodnota na porovnání a do výpisu — ať se „nic" vždycky chová stejně. */
function naText(hodnota: unknown): string {
  if (hodnota === null || hodnota === undefined) return '';
  if (typeof hodnota === 'boolean') return hodnota ? 'Ano' : 'Ne';
  if (Array.isArray(hodnota)) return hodnota.join(', ');
  if (hodnota instanceof Date) return hodnota.toISOString().slice(0, 10);
  return String(hodnota).trim();
}

export type RozdilPole = {
  klic: string;
  popisek: string;
  ted: string;
  nove: string;
  /** Doplnění prázdného pole - to se zapisuje samo, odklikávat se nemusí. */
  doplneni: boolean;
};

/**
 * Co se od dnešního stavu liší. Pole, které se nezměnilo, se v přehledu
 * neukazuje - jinak by se v deseti řádcích ztratil ten jeden, o který jde.
 */
export async function rozdilyPozvanky(p: {
  druh: string;
  userId: string | null;
  companyId: string | null;
  data: unknown;
}): Promise<RozdilPole[]> {
  const vyplnene = (p.data ?? {}) as Record<string, unknown>;
  const soucasne = (await soucasneUdaje(p)) as Record<string, unknown> | null;

  return poleProDruh(p.druh as DruhPozvanky)
    .map((pole) => {
      const nove = naText(vyplnene[pole.klic]);
      const ted = naText(soucasne ? soucasne[pole.klic] : null);
      return { klic: pole.klic, popisek: pole.popisek, ted, nove, doplneni: ted === '' };
    })
    .filter((r) => r.nove !== '' && r.nove !== r.ted);
}

/** Hodnota z formuláře převedená na to, co čeká databáze. */
function proDatabazi(klic: string, hodnota: unknown): unknown {
  if (klic === 'birthDate') {
    const text = naText(hodnota);
    return text ? new Date(text) : null;
  }
  if (klic === 'addressCountry') return kodZeme(naText(hodnota)) || null;
  if (klic === 'vatPayer') return hodnota === true || hodnota === 'true' || hodnota === 'Ano';
  if (klic === 'studioLocations') return Array.isArray(hodnota) ? hodnota : [];
  const text = naText(hodnota);
  return text || null;
}

/**
 * Uložení vyplněného formuláře.
 *
 * Vrací, jestli je hotovo, nebo to čeká na odkliknutí — podle toho se liší
 * i to, co se napíše člověku na obrazovku.
 */
export async function ulozVyplneni(
  token: string,
  udaje: VyplneneUdaje,
  vzkaz: string | null,
): Promise<{ ok: true; hotovo: boolean } | { ok: false; chyba: string }> {
  const p = await najdiPlatnou(token);
  if (!p) return { ok: false, chyba: 'Odkaz už neplatí. Napište nám prosím a pošleme nový.' };
  if (p.stav === 'HOTOVA' || p.stav === 'VYPLNENA') {
    return { ok: false, chyba: 'Formulář už jsme od vás dostali. Děkujeme!' };
  }

  await prisma.pozvankaUdaju.update({
    where: { id: p.id },
    data: {
      data: udaje as any,
      vzkazOdNej: vzkaz?.trim() || null,
      vyplnenoAt: new Date(),
      stav: 'VYPLNENA',
    },
  });

  // Nový záznam se zakládá rovnou; u existujícího se doplní jen to, co bylo
  // prázdné, a přepisy počkají na odkliknutí.
  const jeNovy = !p.userId && !p.companyId;
  const rozdily = await rozdilyPozvanky({ ...p, data: udaje });
  const prepisy = rozdily.filter((r) => !r.doplneni);

  if (jeNovy) {
    await zalozZaznam(p.id, udaje, p.druh as DruhPozvanky);
  } else if (prepisy.length === 0) {
    await zapisDoPortalu(p.id, rozdily.map((r) => r.klic));
  }

  const hotovo = jeNovy || prepisy.length === 0;
  await oznamPrijemcum(p.id, hotovo, prepisy.length);
  return { ok: true, hotovo };
}

/** Kdo od nás vyplněné údaje dostává. Přepínač na účtu, ne jméno v kódu. */
export async function prijemciUdaju() {
  return prisma.user.findMany({
    where: { dostavaVyplneneUdaje: true, active: true },
    select: { id: true, name: true, email: true },
  });
}

async function oznamPrijemcum(pozvankaId: string, hotovo: boolean, kolikCeka: number) {
  const p = await prisma.pozvankaUdaju.findUnique({
    where: { id: pozvankaId },
    include: { user: { select: { name: true } }, company: { select: { name: true } } },
  });
  if (!p) return;

  const kdo = p.user?.name || p.company?.name || p.jmeno || (p.druh === 'HEREC' ? 'Herec' : 'Firma');
  const prijemci = await prijemciUdaju();

  await notifyMany(prijemci.map((u) => u.id), {
    kind: 'udaje-vyplneny',
    title: hotovo ? `${kdo} vyplnil údaje` : `${kdo} vyplnil údaje — čeká na odklepnutí`,
    body: hotovo
      ? 'Údaje jsou v portálu.'
      : `${kolikCeka === 1 ? 'Jeden údaj mění' : `${kolikCeka} údajů mění`} to, co už bylo vyplněné.`,
    url: `/admin/udaje/${p.id}`,
  });

  // E-mail je zvlášť (lib/email.ts) - importuje se až tady, aby lib bez SMTP
  // nespadla při načtení.
  try {
    const { sendVyplneneUdajeEmail } = await import('@/lib/email');
    const odkaz = `${process.env.NEXTAUTH_URL || 'https://www.msportal.cz'}/admin/udaje/${p.id}`;
    for (const prijemce of prijemci) {
      if (!prijemce.email) continue;
      await sendVyplneneUdajeEmail({
        to: prijemce.email,
        jmenoPrijemce: prijemce.name,
        kdo,
        hotovo,
        kolikCeka,
        odkaz,
      });
    }
  } catch (err) {
    console.error('Mail o vyplnenych udajich se nepodarilo poslat:', err);
  }
}

/** Založení nového herce nebo firmy z toho, co člověk vyplnil. */
async function zalozZaznam(pozvankaId: string, udaje: VyplneneUdaje, druh: DruhPozvanky) {
  const hodnoty: Record<string, unknown> = {};
  for (const pole of poleProDruh(druh)) {
    if (udaje[pole.klic] === undefined) continue;
    hodnoty[pole.klic] = proDatabazi(pole.klic, udaje[pole.klic]);
  }

  try {
    if (druh === 'HEREC') {
      const email = naText(udaje.email).toLowerCase();
      if (!email) throw new Error('Bez e-mailu nejde herce založit.');
      const uz = await prisma.user.findUnique({ where: { email } });
      if (uz) {
        // Ten člověk v portálu je, jen jsme to nevěděli - připojíme žádost
        // k němu a necháme to projít odkliknutím jako každou jinou změnu.
        await prisma.pozvankaUdaju.update({ where: { id: pozvankaId }, data: { userId: uz.id } });
        return;
      }
      const code = await nextCode(codePrefixForRole('HEREC'));
      const user = await prisma.user.create({
        data: {
          code,
          // Heslo si nastaví sám pozvánkou do portálu; tohle je jen výplň,
          // kterou se přihlásit nedá.
          passwordHash: randomBytes(32).toString('hex'),
          role: 'HEREC',
          ...hodnoty,
          // Až za vyplněnými poli: e-mail je klíč účtu a musí být srovnaný na
          // malá písmena, ať se stejný člověk nezaloží podruhé.
          email,
        },
      });
      await prisma.pozvankaUdaju.update({
        where: { id: pozvankaId },
        data: { userId: user.id, stav: 'HOTOVA', zpracovanoAt: new Date() },
      });
      return;
    }

    const company = await prisma.company.create({
      data: {
        type: 'DODAVATEL',
        name: naText(udaje.name) || 'Bez názvu',
        ...hodnoty,
        code: await nextCode('F'),
      },
    });
    await prisma.pozvankaUdaju.update({
      where: { id: pozvankaId },
      data: { companyId: company.id, stav: 'HOTOVA', zpracovanoAt: new Date() },
    });
  } catch (err) {
    console.error('Zalozeni zaznamu z pozvanky selhalo:', err);
    // Formulář zůstane VYPLNENÁ - nic se neztratí a dá se to dokončit ručně.
  }
}

/**
 * Zápis vybraných polí do portálu.
 *
 * `klice` říká, co se má zapsat — odkliknutá pole z přehledu. Co v seznamu
 * není, zůstane, jak bylo.
 */
export async function zapisDoPortalu(pozvankaId: string, klice: string[]): Promise<boolean> {
  const p = await prisma.pozvankaUdaju.findUnique({ where: { id: pozvankaId } });
  if (!p || !p.data) return false;

  const udaje = p.data as Record<string, unknown>;
  const hodnoty: Record<string, unknown> = {};
  for (const pole of poleProDruh(p.druh as DruhPozvanky)) {
    if (!klice.includes(pole.klic)) continue;
    if (udaje[pole.klic] === undefined) continue;
    hodnoty[pole.klic] = proDatabazi(pole.klic, udaje[pole.klic]);
  }

  try {
    if (Object.keys(hodnoty).length > 0) {
      if (p.druh === 'HEREC' && p.userId) {
        await prisma.user.update({ where: { id: p.userId }, data: hodnoty });
      } else if (p.druh === 'FIRMA' && p.companyId) {
        await prisma.company.update({ where: { id: p.companyId }, data: hodnoty });
      } else {
        return false;
      }
    }
    await prisma.pozvankaUdaju.update({
      where: { id: pozvankaId },
      data: { stav: 'HOTOVA', zpracovanoAt: new Date() },
    });
    return true;
  } catch (err) {
    console.error('Zapis udaju z pozvanky selhal:', err);
    return false;
  }
}
