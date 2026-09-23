import { prisma } from '@/lib/db';
import { BRUNO_EMAIL } from '@/lib/brunoServer';
import { oznacHerceDotoceno } from '@/lib/dotoceniServer';
import { isRodnyListProjectType } from '@/lib/priceList';

/**
 * DOTOČENO U REKLAM SÁM (zadání 23. 9. 2026: „u projektu typu reklama by měl
 * herce Bruno automaticky překlopit jako dotočené. Ale žádné notifikace,
 * žádné psaní do chatu. Jen ať jsou zvýrazněni.").
 *
 * U audioknihy fajfku „Dotočeno" klikne produkce, protože na ní visí zpráva
 * klientovi. U reklamy se točí a odevzdává hned a nikdo ji neklikal - herci
 * pak v seznamu projektů nikdy nesvítili jako dotočení.
 *
 * KDY: jakmile v kalendáři SKONČÍ natáčení (termín z nabídky i ručně zapsaná
 * událost). Běží to denně z /api/cron/terminy.
 *
 * TICHO: `oznacHerceDotoceno` u reklamy (typ projektu s rodným listem) nikomu
 * nic neposílá - ani nám, ani klientovi - a stav projektu přehodí potichu.
 * Do kanálu projektu se nepíše nic; v historii projektu zůstane, že to byl
 * Bruno.
 */

/** Dál do minulosti se nechodí - starší reklamy ať zůstanou, jak jsou. */
const DOZADU_DNI = 14;

export type VysledekReklamDotoceno = {
  oznaceno: number;
  /** Kolik dvojic projekt+herec se posuzovalo. */
  zvazeno: number;
};

export async function dotocenoUReklam(): Promise<VysledekReklamDotoceno> {
  const ted = new Date();
  const od = new Date(ted.getTime() - DOZADU_DNI * 24 * 60 * 60 * 1000);

  const [sloty, bloky, bruno] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          end: { lt: ted, gt: od },
        },
        select: {
          end: true,
          request: { select: { caflouProjectId: true, actorUserId: true } },
        },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: {
          kind: 'NATACENI',
          end: { lt: ted, gt: od },
          caflouProjectId: { not: null },
          actorUserId: { not: null },
        },
        select: { caflouProjectId: true, actorUserId: true },
      })
      .catch(() => []),
    prisma.user.findUnique({ where: { email: BRUNO_EMAIL }, select: { id: true } }).catch(() => null),
  ]);

  /** Dvojice projekt + herec, u kterých natáčení už skončilo. */
  const dvojice = new Map<string, { caflouProjectId: string; userId: string }>();
  const pridej = (caflouProjectId: string | null | undefined, userId: string | null | undefined) => {
    if (!caflouProjectId || !userId) return; // herec bez účtu fajfku dostat nemůže
    dvojice.set(`${caflouProjectId}|${userId}`, { caflouProjectId, userId });
  };
  for (const s of sloty) pridej(s.request.caflouProjectId, s.request.actorUserId);
  for (const b of bloky) pridej(b.caflouProjectId, b.actorUserId);

  if (dvojice.size === 0) return { oznaceno: 0, zvazeno: 0 };
  // Bez Brunova účtu se nezapisuje - u fajfky má být vidět, kdo ji dal.
  if (!bruno) {
    console.warn('Reklamy: Brunův účet v portálu není, dotočeno se nedoplňuje.');
    return { oznaceno: 0, zvazeno: dvojice.size };
  }

  // Reklama se pozná podle typu projektu (položka ceníku s rodným listem).
  // Typ se ptá jednou za projekt, ne jednou za dvojici.
  const projekty = [...new Set([...dvojice.values()].map((d) => d.caflouProjectId))];
  const meta = await prisma.projectMeta
    .findMany({ where: { caflouProjectId: { in: projekty } }, select: { caflouProjectId: true, projectType: true } })
    .catch(() => []);
  const jeReklama = new Map<string, boolean>();
  for (const m of meta) {
    jeReklama.set(m.caflouProjectId, await isRodnyListProjectType(m.projectType));
  }

  const kReklamam = [...dvojice.values()].filter((d) => jeReklama.get(d.caflouProjectId));
  if (kReklamam.length === 0) return { oznaceno: 0, zvazeno: dvojice.size };

  // Co už fajfku má, se neřeší - ať to klikl člověk, nebo tenhle úklid včera.
  const uzMaji = await prisma.herecDotocen
    .findMany({
      where: { caflouProjectId: { in: kReklamam.map((d) => d.caflouProjectId) } },
      select: { caflouProjectId: true, userId: true },
    })
    .catch(() => []);
  const hotove = new Set(uzMaji.map((h) => `${h.caflouProjectId}|${h.userId}`));

  let oznaceno = 0;
  for (const d of kReklamam) {
    if (hotove.has(`${d.caflouProjectId}|${d.userId}`)) continue;
    const vysledek = await oznacHerceDotoceno(
      d.caflouProjectId,
      d.userId,
      { id: bruno.id, jmeno: 'Bruno (reklama — po natáčení)' },
      // Stav reklamy zůstává, kde je - „Dotočeno" v její řadě stavů není.
      { bezZmenyStavu: true },
    ).catch((err) => {
      console.error(`Reklama ${d.caflouProjectId}: dotoceno se nepodarilo zapsat:`, err);
      return null;
    });
    if (vysledek && !vysledek.uzMel) oznaceno += 1;
  }

  return { oznaceno, zvazeno: dvojice.size };
}
