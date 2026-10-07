import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canSee } from '@/lib/menu';
import { CESTY_SEKCI, maPristup, podlehaPristupum, type KdoPristupy } from '@/lib/pristupy';

/**
 * PRÁVO NA STRÁNKU PODLE KARTY UŽIVATELE (6. 10. 2026).
 *
 * `canSee` z lib/menu.ts umí rozhodovat podle zaškrtávátek z lib/pristupy.ts,
 * ale musí dostat, co ten člověk má zaškrtnuté. Stránky a routy, které si pro
 * to nesáhly do databáze, se dál ptaly jen role - a kdo dostal sekci
 * zaškrtávátkem, stejně skončil na „nemáte oprávnění" (28. 9. 2026 se tím
 * změnilo pravidlo, kontroly u jednotlivých stránek se za ním doplňují
 * postupně).
 *
 * Čte se z databáze, ne ze session: práva se mění na kartě uživatele
 * a nikdo se kvůli nim nebude odhlašovat.
 *
 * NIKDY NEVYHAZUJE: když databáze neodpoví, rozhodne role jako dřív -
 * výpadek spojení nemá nikomu brát přístup.
 */
export async function smiNaStranku(
  user: { id: string; role: string },
  href: string,
): Promise<boolean> {
  let kdo: KdoPristupy | undefined;
  try {
    const ucet = (await prisma.user.findUnique({
      where: { id: user.id },
      select: { superadmin: true, pristupy: true },
    })) as { superadmin: boolean | null; pristupy: string[] | null } | null;
    if (ucet) {
      kdo = { role: user.role, superadmin: ucet.superadmin ?? false, pristupy: ucet.pristupy ?? [] };
    }
  } catch (err) {
    console.error('Přístupy uživatele se nepodařilo načíst:', err);
  }
  return canSee(href, user.role as never, kdo);
}


/** Zaškrtávátka člověka z databáze; prázdno, když se nedají přečíst. */
async function kdoJe(user: { id: string; role: string }): Promise<KdoPristupy> {
  try {
    const ucet = (await prisma.user.findUnique({
      where: { id: user.id },
      select: { superadmin: true, pristupy: true },
    })) as { superadmin: boolean | null; pristupy: string[] | null } | null;
    return {
      role: user.role,
      superadmin: ucet?.superadmin ?? false,
      pristupy: ucet?.pristupy ?? [],
    };
  } catch (err) {
    console.error('Přístupy uživatele se nepodařilo načíst:', err);
    return { role: user.role, superadmin: false, pristupy: [] };
  }
}

/** Klíče sekcí a práv, které otevírají něco pod /admin. */
const ADMIN_KLICE = Array.from(
  new Set(CESTY_SEKCI.filter((c) => c.cesta.startsWith('/admin')).map((c) => c.klic)),
);

/**
 * SMÍ TENHLE ČLOVĚK DO ADMINISTRACE? (6. 10. 2026)
 *
 * Hrubé síto pro společný layout administrace: Žůžo-labůžo ano, a dál každý,
 * kdo má zaškrtnutou aspoň jednu sekci, která něco pod /admin otevírá.
 * O KONKRÉTNÍ STRÁNCE rozhoduje middleware a stránka sama přes `smiNaStranku`
 * - layout nezná adresu, takže přesnější být nemůže.
 */
export async function smiDoAdministrace(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (!podlehaPristupum(user.role)) return false;
  const kdo = await kdoJe(user);
  return ADMIN_KLICE.some((klic) => maPristup(kdo, klic));
}

/** Právo na konkrétní klíč sekce - pro API routy pod /api/admin. */
export async function smiNaSekci(
  user: { id: string; role: string },
  klic: string,
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (!podlehaPristupum(user.role)) return false;
  return maPristup(await kdoJe(user), klic);
}


/**
 * JE PŘIHLÁŠENÝ ČLOVĚK SUPERADMIN? (7. 10. 2026)
 *
 * Pro věci, které nemá vidět ani zbytek Žůžo-labůža - například kalendář
 * splatností v neuhrazených fakturách. `maPristup` se na to použít nedá:
 * ta říká „smí na sekci", a superadmin v ní znamená jen „vlezu všude".
 *
 * Čte se to z databáze, ne ze session - příznak se mění na kartě uživatele
 * a nikdo se kvůli tomu nebude odhlašovat.
 */
export async function jsemSuperadmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const u = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, superadmin: true },
  })) as { active: boolean; superadmin: boolean | null } | null;
  return Boolean(u?.active && u.superadmin);
}

/**
 * SMÍ PŘIHLÁŠENÝ ČLOVĚK NA KARTY FIREM? (připomínka 7. 10. 2026)
 *
 * Pro odkaz na kartu firmy u dokladu a u projektu. Ptá se na cestu, ne na
 * roli: kdo má zaškrtnutou sekci *Firmy*, tomu se odkaz ukáže, a kdo ji
 * nemá, tomu se nevykreslí vůbec - mrtvý odkaz, který skončí přesměrováním
 * zpátky na Projekty, je horší než žádný.
 */
export async function smiNaKartyFirem(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  return smiNaStranku({ id: session.user.id, role: session.user.role }, '/admin/companies');
}

/**
 * Smí přihlášený člověk do nastavení studií? Zkratka pro routy
 * /api/admin/studia/*, které jinak pouštějí jen Žůžo-labůžo: od 6. 10. 2026
 * tam patří i ten, kdo má na kartě zaškrtnuté *Nastavení studií* - jinak by
 * stránku viděl, ale nic by si na ní neuložil.
 */
export async function smiNaStudia(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  return smiNaSekci({ id: session.user.id, role: session.user.role }, 'STUDIA.NASTAVENI');
}
