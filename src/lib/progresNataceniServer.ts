import { prisma } from '@/lib/db';
import { posledniStrany } from '@/lib/brunoServer';
import { pocetStranTextu } from '@/lib/textProjektuServer';
import { progresProjektu, progresZeStran, type ProgresNataceni } from '@/lib/progresNataceni';

/**
 * PROGRES NATÁČENÍ PRO VÍC PROJEKTŮ NAJEDNOU (zadání 19. 9. 2026: „měl by
 * ho vidět i klient a hlavně my v detailu projektu").
 *
 * Tři dotazy pro celou stránku: poslední strany (Bruno), kdo má dotočeno
 * a počet stran PDF (s mezipamětí, viz textProjektuServer).
 *
 * Strana u herce: jeho vlastní zápis; když ho nemá, zápis bez herce
 * (projekt s jediným hercem, kde Bruno herce neurčil).
 */
export type ProgresProjektu = {
  celkem: ProgresNataceni;
  herci: Record<string, ProgresNataceni>;
  stranTextu: number | null;
};

export async function nactiProgresNataceni(
  projekty: { id: string; herciIds: string[] }[],
): Promise<Map<string, ProgresProjektu>> {
  const vysledek = new Map<string, ProgresProjektu>();
  if (projekty.length === 0) return vysledek;
  const ids = projekty.map((p) => p.id);

  const [strany, dotoceno, stran] = await Promise.all([
    posledniStrany(ids),
    prisma.herecDotocen
      .findMany({ where: { caflouProjectId: { in: ids } }, select: { caflouProjectId: true, userId: true } })
      .catch(() => [] as { caflouProjectId: string; userId: string }[]),
    pocetStranTextu(ids),
  ]);
  const dotocene = new Set(dotoceno.map((d) => `${d.caflouProjectId}:${d.userId}`));

  for (const p of projekty) {
    const celkemStran = stran.get(p.id) ?? null;
    const herci: Record<string, ProgresNataceni> = {};
    for (const h of p.herciIds) {
      const strana = strany.get(`${p.id}:${h}`) ?? strany.get(`${p.id}:`) ?? null;
      herci[h] = progresZeStran(strana, celkemStran, dotocene.has(`${p.id}:${h}`));
    }
    const celkem =
      p.herciIds.length > 0
        ? progresProjektu(p.herciIds.map((h) => herci[h]))
        : progresZeStran(strany.get(`${p.id}:`) ?? null, celkemStran, false);
    vysledek.set(p.id, { celkem, herci, stranTextu: celkemStran });
  }
  return vysledek;
}
