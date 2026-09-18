import { prisma } from '@/lib/db';

/**
 * PROJEKT PŘEDVYPLNĚNÝ DO NOVÉHO DOKLADU (zadání 18. 9. 2026: „když jsem tady
 * v dokladech na detailu projektu, tak by bylo dobré rovnou vytvořit nějaký
 * doklad, který bude navázaný na projekt").
 *
 * Zakládací stránky nabídky, faktury i smlouvy si podle `?projekt=` vytáhnou
 * jméno projektu a jeho klienta - aby se po kliknutí z detailu projektu
 * nemuselo znovu vybírat to, co portál ví.
 *
 * Když projekt v portálu kartu nemá (žije jen v Caflou), vrací se aspoň jeho
 * ID; doklad se na něj naváže a jméno si k němu přiřadí výběr projektu sám.
 */
export type ProjektProDoklad = {
  caflouProjectId: string;
  nazev: string | null;
  companyId: string | null;
};

export async function projektProDoklad(
  caflouProjectId?: string | null,
): Promise<ProjektProDoklad | null> {
  const id = caflouProjectId?.trim();
  if (!id) return null;

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: id },
    select: { name: true, companyId: true },
  });

  return {
    caflouProjectId: id,
    nazev: meta?.name?.trim() || null,
    companyId: meta?.companyId ?? null,
  };
}
