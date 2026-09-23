import { prisma } from '@/lib/db';
import { klicRezie } from '@/lib/rezieOnline';

/**
 * Která událost v kalendáři je PRVNÍ frekvencí daného herce na daném
 * projektu (zadání 23. 9. 2026 - viz lib/rezieOnline.ts).
 *
 * Hledá se přes celou historii, ne jen přes zobrazený týden: první frekvence
 * mohla být před měsícem a ta dnešní pak značku mít nemá. Do porovnání jdou
 * potvrzené i vybrané termíny z nabídek a ručně zapsaná natáčení.
 */

export type UdalostProRezii = {
  id: string;
  caflouProjectId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  /** Výjimka uložená u události: true / false ji zapne nebo vypne natvrdo. */
  rezieOnline: boolean | null;
  /**
   * CASTING MÁ REŽII VŽDYCKY (zadání 23. 9. 2026: „a u castingu to bude
   * pokaždé") - na casting se režie připojuje na každý, ne jen na první.
   */
  vzdy?: boolean;
};

/**
 * Vrátí id událostí, u kterých se má ukázat ikona režie. Bere v potaz
 * uložené výjimky: `rezieOnline === false` značku sundá, i když je frekvence
 * první; `true` ji přidá, i když první není.
 */
export async function oznacRezii(udalosti: UdalostProRezii[]): Promise<Set<string>> {
  const vysledek = new Set<string>();

  const projekty = new Set<string>();
  for (const u of udalosti) {
    if (u.rezieOnline === true) vysledek.add(u.id);
    if (u.rezieOnline === null && u.vzdy) vysledek.add(u.id);
    if (klicRezie(u.caflouProjectId, u.actorUserId, u.actorName)) {
      projekty.add((u.caflouProjectId ?? '').trim());
    }
  }
  if (projekty.size === 0) return vysledek;

  const seznam = [...projekty];
  const [sloty, bloky] = await Promise.all([
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          request: { caflouProjectId: { in: seznam } },
        },
        select: {
          id: true,
          start: true,
          request: { select: { caflouProjectId: true, actorUserId: true, actorName: true } },
        },
      })
      .catch(() => []),
    prisma.studioBlock
      .findMany({
        where: { kind: 'NATACENI', caflouProjectId: { in: seznam } },
        select: { id: true, start: true, caflouProjectId: true, actorUserId: true, actorName: true },
      })
      .catch(() => []),
  ]);

  /** Ke každé dvojici projekt+herec ta nejdřívější frekvence. */
  const prvni = new Map<string, { id: string; start: Date }>();
  const zvaz = (id: string, start: Date, klic: string | null) => {
    if (!klic) return;
    const ma = prvni.get(klic);
    if (!ma || start.getTime() < ma.start.getTime()) prvni.set(klic, { id, start });
  };

  for (const s of sloty) {
    zvaz(s.id, s.start, klicRezie(s.request.caflouProjectId, s.request.actorUserId, s.request.actorName));
  }
  for (const b of bloky) {
    zvaz(b.id, b.start, klicRezie(b.caflouProjectId, b.actorUserId, b.actorName));
  }

  const prvniIds = new Set([...prvni.values()].map((p) => p.id));
  for (const u of udalosti) {
    if (u.rezieOnline !== null) continue; // ruční výjimka rozhodla výš
    if (prvniIds.has(u.id)) vysledek.add(u.id);
  }
  return vysledek;
}
