import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { INTERNAL_ROLES, ROBOT_ROLES } from '@/lib/roles';
import {
  datumZPrahy,
  ocistiOdpovedi,
  ocistiOtazky,
  odkazNaMapu,
  radkyOdpovedi,
  sOtazkouDorazi,
  type Kandidat,
  type Odpovedi,
  type Otazka,
  type PozvankaPrehled,
} from '@/lib/akce';
import { sendPotvrzeniAkceEmail, sendPripomenutiAkceEmail } from '@/lib/email';
import { jazykPodleEmailu } from '@/lib/jazykPrijemce';
import { zakladniAdresa } from '@/lib/aplikace';

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

/**
 * Otázky akce, očištěné - z databáze přijdou jako JSON. Základní „dorazíte?"
 * je vždycky první, i u akce založené dřív, než šla upravovat.
 */
export function otazkyAkce(akce: { otazky?: unknown } | null): Otazka[] {
  return sOtazkouDorazi(ocistiOtazky(akce?.otazky ?? []));
}

/**
 * ODPOVĚDI Z PRVNÍ VERZE ANKETY. Než si pořadatel začal otázky skládat sám
 * (25. 11. 2026), ukládaly se do vlastních sloupců. Starší pozvánka tak má
 * odpovědi tam, ne v `odpovedi` - přečtou se pod klíči, které dnes nesou
 * výchozí otázky, takže v přehledu nic nechybí.
 */
function zeStarychSloupcu(radek: {
  ubytovani: boolean | null;
  piti: string[] | null;
  pitiText: string | null;
  poznamka: string | null;
}): Odpovedi {
  const hotove: Odpovedi = {};
  if (radek.ubytovani !== null && radek.ubytovani !== undefined) hotove.ubytovani = radek.ubytovani;
  if ((radek.piti ?? []).length > 0) hotove.piti = radek.piti as string[];
  const vzkaz = [radek.pitiText, radek.poznamka].filter(Boolean).join(' · ');
  if (vzkaz) hotove.poznamka = vzkaz;
  return hotove;
}

export async function pozvankyAkce(akceId: string): Promise<PozvankaPrehled[]> {
  try {
    const radky = await prisma.pozvankaNaAkci.findMany({
      where: { akceId },
      orderBy: [{ jmeno: 'asc' }],
    });
    // Přes `unknown`: pole typu String[] a Json náš kontrolní stub Prismy
    // nezná a bez toho by se na nich typová kontrola zasekla.
    return (radky as unknown as {
      id: string;
      jmeno: string;
      email: string;
      odeslanoAt: Date | null;
      odpovedelAt: Date | null;
      dorazi: boolean | null;
      odpovedi: unknown;
      ubytovani: boolean | null;
      piti: string[] | null;
      pitiText: string | null;
      poznamka: string | null;
    }[]).map((p) => {
      const nove = (p.odpovedi ?? {}) as Odpovedi;
      const odpovedi = Object.keys(nove).length > 0 ? nove : zeStarychSloupcu(p);
      return {
        id: p.id,
        jmeno: p.jmeno,
        email: p.email,
        odeslanoAt: p.odeslanoAt ? p.odeslanoAt.toISOString() : null,
        odpovedelAt: p.odpovedelAt ? p.odpovedelAt.toISOString() : null,
        dorazi: p.dorazi,
        odpovedi,
      };
    });
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

/**
 * Odpověď z otevřeného odkazu. Co nepatří k otázkám té akce, se zahodí -
 * server si je načte sám, ne z prohlížeče.
 */
export async function zapisOdpoved(
  token: string,
  odpoved: { dorazi: boolean; odpovedi: unknown },
): Promise<boolean> {
  try {
    const pozvanka = (await prisma.pozvankaNaAkci.findUnique({
      where: { token },
      select: {
        id: true,
        jmeno: true,
        email: true,
        akce: { select: { nazev: true, kdy: true, misto: true, mapa: true, otazky: true } },
      },
    })) as {
      id: string;
      jmeno: string;
      email: string;
      akce: { nazev: string; kdy: Date | null; misto: string | null; mapa: string | null; otazky?: unknown };
    } | null;
    if (!pozvanka) return false;

    const otazky = otazkyAkce(pozvanka.akce as { otazky?: unknown } | null);
    const ulozene = odpoved.dorazi ? ocistiOdpovedi(otazky, odpoved.odpovedi) : {};
    await prisma.pozvankaNaAkci.update({
      where: { id: pozvanka.id },
      data: {
        dorazi: odpoved.dorazi,
        // Kdo nedorazí, u toho zbytek ankety nedává smysl.
        odpovedi: ulozene,
        odpovedelAt: new Date(),
        // Odpověď se dá přepsat - a pak má přijít i nová připomínka s tím,
        // co člověk vyplnil teď.
        pripomenutoAt: null,
      },
    });

    // POTVRZENÍ CHODÍ HNED (zadání 25. 11. 2026). Když pošta zlobí, odpověď
    // už je uložená - mail se kvůli tomu nesmí vrátit jako chyba formuláře.
    await posliPotvrzeni({
      token,
      id: pozvanka.id,
      jmeno: pozvanka.jmeno,
      email: pozvanka.email,
      akce: pozvanka.akce,
      otazky,
      dorazi: odpoved.dorazi,
      odpovedi: ulozene,
    }).catch((err) => console.error('Potvrzení odpovědi se nepodařilo odeslat:', err));

    return true;
  } catch (err) {
    console.error('Odpověď na pozvánku se nepodařilo uložit:', err);
    return false;
  }
}

/** Potvrzení té odpovědi, kterou člověk právě odeslal. */
async function posliPotvrzeni(vstup: {
  token: string;
  id: string;
  jmeno: string;
  email: string;
  akce: { nazev: string; kdy: Date | null; misto: string | null; mapa: string | null };
  otazky: Otazka[];
  dorazi: boolean;
  odpovedi: Odpovedi;
}): Promise<void> {
  const vysledek = await sendPotvrzeniAkceEmail({
    to: vstup.email,
    jmenoPrijemce: vstup.jmeno,
    nazevAkce: vstup.akce.nazev,
    kdy: vstup.akce.kdy,
    misto: vstup.akce.misto,
    odkaz: `${zakladniAdresa()}/pozvanka/${vstup.token}`,
    mapa: odkazNaMapu(vstup.akce.misto, vstup.akce.mapa),
    dorazi: vstup.dorazi,
    odpovedi: radkyOdpovedi(vstup.otazky, vstup.odpovedi),
    jazyk: await jazykPodleEmailu(vstup.email),
  });
  if (!vysledek.sent) return;
  await prisma.pozvankaNaAkci.update({
    where: { id: vstup.id },
    data: { potvrzeniAt: new Date() },
  });
}

/**
 * PŘIPOMÍNKA DEN PŘEDEM (zadání 25. 11. 2026: „pak připomínací mail den
 * dopředu, když člověk potvrdí účast, kde mu přijde připomenutí a rovnou
 * odkaz s mapkou").
 *
 * KOMU: jen tomu, kdo řekl, že dorazí. Kdo neodpověděl nebo se omluvil,
 * připomínku nedostane - ta má být službou, ne naháněním.
 *
 * KDY: cron běží každé ráno a vezme akce, které začínají ZÍTRA v čase Prahy.
 * Razítko `pripomenutoAt` hlídá, že odejde jednou; po změně odpovědi se
 * maže, takže kdo potvrdí na poslední chvíli, připomínku ještě dostane.
 */
export async function pripomenAkce(): Promise<{ odeslano: number; akci: number }> {
  const ted = new Date();
  const zitra = new Date(ted.getTime() + 24 * 60 * 60 * 1000);
  const den = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(zitra);
  const od = datumZPrahy(`${den}T00:00`);
  const doKdy = datumZPrahy(`${den}T23:59`);
  if (!od || !doKdy) return { odeslano: 0, akci: 0 };

  const akce = (await prisma.akce.findMany({
    where: { kdy: { gte: od, lte: doKdy } },
  })) as {
    id: string;
    nazev: string;
    kdy: Date | null;
    misto: string | null;
    mapa: string | null;
    text: string | null;
    otazky?: unknown;
  }[];
  if (akce.length === 0) return { odeslano: 0, akci: 0 };

  const zaklad = zakladniAdresa();
  let odeslano = 0;

  for (const a of akce) {
    const otazky = otazkyAkce(a as { otazky?: unknown });
    const mapa = odkazNaMapu(a.misto, a.mapa);
    const pozvanky = (await prisma.pozvankaNaAkci.findMany({
      where: { akceId: a.id, dorazi: true, pripomenutoAt: null },
      orderBy: { jmeno: 'asc' },
    })) as unknown as {
      id: string;
      jmeno: string;
      email: string;
      token: string;
      odpovedi: unknown;
    }[];

    for (const p of pozvanky) {
      try {
        const vysledek = await sendPripomenutiAkceEmail({
          to: p.email,
          jmenoPrijemce: p.jmeno,
          nazevAkce: a.nazev,
          kdy: a.kdy,
          misto: a.misto,
          text: a.text,
          odkaz: `${zaklad}/pozvanka/${p.token}`,
          mapa,
          odpovedi: radkyOdpovedi(otazky, (p.odpovedi ?? {}) as Odpovedi),
          jazyk: await jazykPodleEmailu(p.email),
        });
        if (!vysledek.sent) continue;
        await prisma.pozvankaNaAkci.update({
          where: { id: p.id },
          data: { pripomenutoAt: new Date() },
        });
        odeslano += 1;
      } catch (err) {
        // Jedna neprůchozí adresa nesmí zastavit zbytek rozesílky.
        console.error(`Připomínku akce ${a.id} se nepodařilo odeslat na ${p.email}:`, err);
      }
    }
  }

  return { odeslano, akci: akce.length };
}
