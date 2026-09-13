import { prisma } from '@/lib/db';
import { prehodStavPodleDotoceni } from '@/lib/dotoceniStavServer';
import { zapisDoplneniZpetne, type Puvodce } from '@/lib/projektLogServer';

/**
 * DOPLNĚNÍ „DOTOČENO" ZPĚTNĚ (zadání 13. 9. 2026: „ve chvíli, kdy jsme
 * přenesli projekty v Caflou, jsme neměli dodělané tlačítko Dotočeno
 * s hercem… potřebuju to přehodit, ale aby se nic nestalo a nikam nešla
 * notifikace").
 *
 * PROČ TO NEJDE PŘES /api/projekty/[id]/herci-dotoceno: ten endpoint umí
 * dvě zprávy — mail lidem s „Dostává zprávy o dotočení" za každého herce
 * a přes překlopení stavu i zprávu KLIENTOVI. U srovnávání historie by
 * klientům přišla novinka o něčem, co se stalo před měsíci.
 *
 * Nedělá se to vypínačem v tom endpointu schválně. Vypínač jde zapomenout
 * zapnutý a pak z běžného provozu tiše nechodí zprávy, kterých si nikdo
 * nevšimne — všimne se až toho, že klient nic nedostal. Tahle cesta je
 * oddělená, vede jen z jedné obrazovky v administraci a poslat zprávu
 * neumí vůbec.
 *
 * STAV SE PŘEKLÁPÍ STEJNĚ JAKO JINDY (zadání 13. 9. 2026: „když je to
 * v natáčíme/stříháme a zároveň je dotočeno s hercem, tak musí být stav
 * dotočeno/stříháme"). Používá se tentýž `prehodStavPodleDotoceni`, jen
 * v tichém režimu — kdyby se pravidlo psalo tady podruhé, po první úpravě
 * by se obě verze rozešly.
 *
 * DO HISTORIE PROJEKTU SE ZÁPIS DĚLÁ. Za rok musí být poznat, proč u těchhle
 * projektů není žádná odeslaná zpráva.
 */

export type VysledekDoplneni = {
  caflouProjectId: string;
  /** Herci, kterým fajfka přibyla teď. Ti, co ji měli, se nepočítají. */
  pridano: string[];
  /** Překlopení stavu, když na něj došlo. */
  stav: { zStavu: string; naStav: string } | null;
};

/**
 * Doplní fajfku vybraným hercům u jednoho projektu a případně překlopí stav.
 *
 * Herec, který fajfku UŽ MÁ, se nechává být: `dotocenoAt` by se přepsalo na
 * dnešek a tím by se ztratilo datum, kdy se dotočilo doopravdy.
 */
export async function doplnDotocenoZpetne(
  caflouProjectId: string,
  userIds: string[],
  puvodce: Puvodce,
): Promise<VysledekDoplneni> {
  const projekt = await prisma.projectMeta.findUnique({
    where: { caflouProjectId },
    select: { herci: { select: { id: true } } },
  });
  if (!projekt) return { caflouProjectId, pridano: [], stav: null };

  // Jen herci, kteri u projektu opravdu jsou - seznam chodi z prohlizece
  // a nesmi do databaze dostat nikoho, kdo s projektem nema nic spolecneho.
  const uProjektu = new Set(projekt.herci.map((h) => h.id));
  const chteni = userIds.filter((id) => uProjektu.has(id));
  if (chteni.length === 0) return { caflouProjectId, pridano: [], stav: null };

  const uz = await prisma.herecDotocen.findMany({
    where: { caflouProjectId, userId: { in: chteni } },
    select: { userId: true },
  });
  const maji = new Set(uz.map((z) => z.userId));
  const pridano = chteni.filter((id) => !maji.has(id));
  if (pridano.length === 0) return { caflouProjectId, pridano: [], stav: null };

  await prisma.herecDotocen.createMany({
    data: pridano.map((userId) => ({
      caflouProjectId,
      userId,
      potvrdilUserId: puvodce.id,
      potvrdilJmeno: puvodce.jmeno,
    })),
    skipDuplicates: true,
  });

  // Do historie jde i samotne doplneni fajfky, ne jen zmena stavu - jinak by
  // u projektu, ktery na prekloneni stavu nedosel, nebylo po zapisu nic videt.
  const jmena = await prisma.user.findMany({
    where: { id: { in: pridano } },
    select: { name: true, email: true },
  });
  await zapisDoplneniZpetne({
    caflouProjectId,
    popis: `Dotočeno doplněno zpětně: ${jmena
      .map((u) => u.name || u.email)
      .join(', ')} — bez odeslání zpráv (srovnání historie po přenosu z Caflou).`,
    puvodce,
  });

  const stav = await prehodStavPodleDotoceni(caflouProjectId, puvodce, true);

  return {
    caflouProjectId,
    pridano,
    stav: stav.zmeneno ? { zStavu: stav.zStavu, naStav: stav.naStav } : null,
  };
}
