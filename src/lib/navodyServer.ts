import { prisma } from '@/lib/db';
import { slugZNazvu } from '@/lib/navody';

/**
 * Práce s návody, která sahá do databáze (zadání 16. 9. 2026).
 *
 * Schválně mimo routy: adresu návodu potřebuje jak zakládání, tak
 * přejmenování, a routa v Next.js nesmí vyvážet nic jiného než své metody -
 * jinak build spadne.
 */

/** Adresa musí být jedinečná — když se název opakuje, přidá se číslo. */
export async function volnySlug(nazev: string, kromeId?: string): Promise<string> {
  const zaklad = slugZNazvu(nazev);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? zaklad : `${zaklad}-${i + 1}`;
    const uz = await prisma.navod.findUnique({ where: { slug }, select: { id: true } });
    if (!uz || uz.id === kromeId) return slug;
  }
  return `${zaklad}-${Date.now()}`;
}

/**
 * DRUH ZAKÁZEK KLIENTA PRO NÁPOVĚDU (zadání 24. 9. 2026: „je třeba rozlišit
 * dva druhy - pro audioknihy a pro reklamy, podle toho by se i návody měly
 * objevovat klientovi").
 *
 * Vrací, co má firma zaškrtnuté v Druhu zakázek (Firmy → karta firmy) - podle
 * toho se už teď řídí, jakou objednávku klient vidí, takže nápověda jede
 * podle stejné jediné pravdy a nikdo nemusí nic nastavovat dvakrát.
 *
 * `null` znamená NEFILTROVAT: kdo není klient (náš tým, herec, náhledový
 * účet) a kdo nemá firmu, dostane návody jako dosud. Stejně tak firma, která
 * nemá zaškrtnuté nic - raději o návod navíc než bez nápovědy.
 */
export async function druhyKlienta(
  role: string,
  companyId: string | null | undefined,
): Promise<string[] | null> {
  if (role !== 'CLIENT' || !companyId) return null;
  try {
    const firma = await prisma.company.findUnique({
      where: { id: companyId },
      select: { dealsAudiobooks: true, dealsAds: true },
    });
    if (!firma) return null;
    const druhy: string[] = [];
    if (firma.dealsAudiobooks) druhy.push('AUDIOBOOK');
    if (firma.dealsAds) druhy.push('AD');
    return druhy.length > 0 ? druhy : null;
  } catch {
    return null;
  }
}

/** Totéž, když je po ruce jen ID člověka (Bruno) - dohledá si roli i firmu sám. */
export async function druhyUzivatele(userId: string): Promise<string[] | null> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, companyId: true },
    });
    if (!u) return null;
    return await druhyKlienta(String(u.role), u.companyId);
  } catch {
    return null;
  }
}
