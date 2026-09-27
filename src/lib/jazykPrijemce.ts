import { prisma } from '@/lib/db';
import { jeJazyk, type Jazyk } from '@/lib/jazyk';

/**
 * JAZYK PŘÍJEMCE POŠTY (dávka 6 překladu, 27. 9. 2026).
 *
 * Pravidlo 5 v docs/preklad-portalu.md: texty, které jdou ven z portálu -
 * e-maily a PDF dokladů - se řídí jazykem PŘÍJEMCE, ne přepínačem v liště
 * toho, kdo akci spustil. Když zvukař označí přeposlech za hotový, odejde
 * zpráva klientovi; jazyk té zprávy patří klientovi, ne zvukaři.
 *
 * Bere se z `User.jazyk`, kam ho zapisuje přepínač v liště. Kdo si jazyk
 * nikdy nepřepnul, má tam výchozí češtinu - nikomu tedy nepřijde anglický
 * mail jen proto, že jsme zavedli tenhle sloupec.
 *
 * VŠECHNY FUNKCE JSOU ODOLNÉ PROTI CHYBĚ. Když se do databáze nedostaneme,
 * vrátí se čeština: horší je nepřijatý mail než mail ve špatném jazyce.
 */

/** Jazyk podle e-mailové adresy - pro maily, kde známe jen adresu. */
export async function jazykPodleEmailu(email?: string | null): Promise<Jazyk> {
  const adresa = email?.trim().toLowerCase();
  if (!adresa) return 'cs';
  try {
    const u = await prisma.user.findUnique({
      where: { email: adresa },
      select: { jazyk: true },
    });
    return jeJazyk(u?.jazyk) ? u.jazyk : 'cs';
  } catch {
    return 'cs';
  }
}

/** Jazyk podle účtu - pro maily, kde máme id uživatele. */
export async function jazykUzivatele(userId?: string | null): Promise<Jazyk> {
  if (!userId) return 'cs';
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { jazyk: true },
    });
    return jeJazyk(u?.jazyk) ? u.jazyk : 'cs';
  } catch {
    return 'cs';
  }
}

/**
 * Jazyk pro celou firmu - když mail odchází na adresu, která účet nemá
 * (fakturační schránka, účtárna). Rozhoduje většina: když si aspoň jeden
 * člověk firmy přepnul na angličtinu a nikdo jiný nemá češtinu vybranou
 * ručně, píše se anglicky.
 */
export async function jazykFirmy(companyId?: string | null): Promise<Jazyk> {
  if (!companyId) return 'cs';
  try {
    const lidi = await prisma.user.findMany({
      where: { companyId, active: true },
      select: { jazyk: true },
    });
    if (lidi.length === 0) return 'cs';
    const anglicky = lidi.filter((u) => u.jazyk === 'en').length;
    return anglicky > lidi.length / 2 ? 'en' : 'cs';
  } catch {
    return 'cs';
  }
}
