import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { INTERNAL_ROLES, ROBOT_ROLES } from '@/lib/roles';
import { pouzeZnamePiti, type Kandidat, type PozvankaPrehled } from '@/lib/akce';

export type { Kandidat };

/**
 * FIREMNÍ AKCE - serverová část (zadání 25. 11. 2026). Co sahá do databáze,
 * je tady; číselníky a počty v lib/akce.ts.
 */

/**
 * KDO AKCE SPRAVUJE (zadání: „chci to ovládat jen já").
 *
 * Příznak na kartě účtu, ne jméno v kódu a ani jen role: Žůžo-labůžo je víc
 * lidí a večírek chystá jeden. Kdo to nemá, o sekci vůbec neví - pozvánku
 * dostane mailem jako každý jiný.
 */
export async function smiSpravovatAkce(userId: string): Promise<boolean> {
  try {
    const ucet = (await prisma.user.findUnique({
      where: { id: userId },
      select: { spravujeAkce: true, superadmin: true },
    })) as { spravujeAkce: boolean | null; superadmin: boolean | null } | null;
    return Boolean(ucet?.spravujeAkce || ucet?.superadmin);
  } catch (err) {
    console.error('Práva k akcím se nepodařilo načíst:', err);
    return false;
  }
}

/** Náhodný odkaz do mailu - stejně dlouhý jako ostatní otevřené odkazy. */
export function novyTokenPozvanky(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * KOHO JDE POZVAT (odpověď 25. 11. 2026: „tým, herci a klienti").
 *
 * Roboti a obrazovky ve studiu sem nepatří - za těmi účty nikdo nestojí.
 * Účty bez adresy taky ne; pozvánka chodí mailem a jinak by jen visela
 * v seznamu jako nedoručitelná.
 */
export async function kandidatiNaPozvanku(): Promise<Kandidat[]> {
  try {
    const lide = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: [...INTERNAL_ROLES, 'HEREC', 'CLIENT'] },
        NOT: { role: { in: ROBOT_ROLES } },
      },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        company: { select: { name: true } },
      },
    });

    return (lide as { id: string; name: string | null; email: string; role: string; company: { name: string } | null }[])
      .filter((u) => (u.email ?? '').includes('@'))
      .map((u) => ({
        id: u.id,
        jmeno: (u.name || u.email).trim(),
        email: u.email.trim().toLowerCase(),
        skupina: u.role === 'HEREC' ? ('HERCI' as const) : u.role === 'CLIENT' ? ('KLIENTI' as const) : ('TYM' as const),
        firma: u.company?.name ?? null,
      }));
  } catch (err) {
    console.error('Seznam lidí k pozvání se nepodařilo načíst:', err);
    return [];
  }
}

export async function pozvankyAkce(akceId: string): Promise<PozvankaPrehled[]> {
  try {
    const radky = await prisma.pozvankaNaAkci.findMany({
      where: { akceId },
      orderBy: [{ jmeno: 'asc' }],
    });
    // Přes `unknown`: pole typu String[] náš kontrolní stub Prismy nezná
    // a bez toho by se na nich typová kontrola zasekla.
    return (radky as unknown as {
      id: string;
      jmeno: string;
      email: string;
      odeslanoAt: Date | null;
      odpovedelAt: Date | null;
      dorazi: boolean | null;
      ubytovani: boolean | null;
      piti: string[];
      pitiText: string | null;
      poznamka: string | null;
    }[]).map((p) => ({
      id: p.id,
      jmeno: p.jmeno,
      email: p.email,
      odeslanoAt: p.odeslanoAt ? p.odeslanoAt.toISOString() : null,
      odpovedelAt: p.odpovedelAt ? p.odpovedelAt.toISOString() : null,
      dorazi: p.dorazi,
      ubytovani: p.ubytovani,
      piti: p.piti ?? [],
      pitiText: p.pitiText,
      poznamka: p.poznamka,
    }));
  } catch (err) {
    console.error(`Pozvánky k akci ${akceId} se nepodařilo načíst:`, err);
    return [];
  }
}

/**
 * Přidá lidi k akci. Kdo už pozvaný je, zůstane, jak je - jméno ani odpověď
 * se nepřepisují (`@@unique([akceId, email])` + skipDuplicates).
 */
export async function pridejPozvane(
  akceId: string,
  lide: { userId?: string | null; jmeno: string; email: string }[],
): Promise<number> {
  const ocistene = lide
    .map((l) => ({
      userId: l.userId ?? null,
      jmeno: (l.jmeno || l.email).trim().slice(0, 200),
      email: l.email.trim().toLowerCase().slice(0, 200),
    }))
    .filter((l) => l.email.includes('@'));
  if (ocistene.length === 0) return 0;

  const vysledek = await prisma.pozvankaNaAkci.createMany({
    data: ocistene.map((l) => ({ ...l, akceId, token: novyTokenPozvanky() })),
    skipDuplicates: true,
  });
  return vysledek.count;
}

/** Odpověď z otevřeného odkazu. Pití se čistí proti číselníku. */
export async function zapisOdpoved(
  token: string,
  odpoved: {
    dorazi: boolean;
    ubytovani: boolean;
    piti: string[];
    pitiText: string | null;
    poznamka: string | null;
  },
): Promise<boolean> {
  try {
    await prisma.pozvankaNaAkci.update({
      where: { token },
      data: {
        dorazi: odpoved.dorazi,
        // Kdo nedorazí, u toho nemá smysl držet postel ani skleničku.
        ubytovani: odpoved.dorazi ? odpoved.ubytovani : false,
        piti: odpoved.dorazi ? pouzeZnamePiti(odpoved.piti) : [],
        pitiText: odpoved.dorazi ? (odpoved.pitiText || null) : null,
        poznamka: odpoved.poznamka || null,
        odpovedelAt: new Date(),
      },
    });
    return true;
  } catch (err) {
    console.error('Odpověď na pozvánku se nepodařilo uložit:', err);
    return false;
  }
}
