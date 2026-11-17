import { prisma } from '@/lib/db';
import { canEditProjectMeta, type Role } from '@/lib/roles';

/**
 * KDO SMÍ PŘEHAZOVAT STAVY PROJEKTŮ (zadání 17. 11. 2026: „Tomáš Ilavský by
 * měl mít možnost přehazovat stavy projektů").
 *
 * Celou kartu interních údajů mění jen Produkce a Žůžo-labůžo
 * (`canEditProjectMeta` v lib/roles.ts). Tohle je o jedno políčko užší právo:
 * zaškrtávátko `meniStavProjektu` na kartě uživatele pustí zvukaře k STAVU
 * projektu a k ničemu jinému - ani k zakládání projektů, ani ke zbytku karty.
 *
 * Příznak u účtu, ne jméno v kódu - stejné pravidlo jako
 * `spravujeTechParametry` (viz lib/technickeParametryServer.ts): až to bude
 * přehazovat někdo další, překlikne se to v Administraci.
 */
export async function smiMenitStavProjektu(
  userId: string | null | undefined,
  role: Role | null | undefined,
): Promise<boolean> {
  if (role && canEditProjectMeta(role)) return true;
  if (!userId) return false;
  const u = (await prisma.user.findUnique({
    where: { id: userId },
    select: { active: true, meniStavProjektu: true },
  })) as { active: boolean; meniStavProjektu: boolean } | null;
  return Boolean(u?.active && u.meniStavProjektu);
}

/**
 * Nese požadavek JEN stav projektu? Kdo má zaškrtnuté `meniStavProjektu`,
 * smí přes /api/projects/[id]/meta poslat tohle a nic víc - jinak by se tím
 * zaškrtávátkem otevřela celá karta.
 */
export function jenZmenaStavu(telo: Record<string, unknown>): boolean {
  const klice = Object.keys(telo).filter((k) => telo[k] !== undefined);
  return klice.length === 1 && klice[0] === 'statusName';
}
