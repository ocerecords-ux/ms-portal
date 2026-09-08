import { prisma } from '@/lib/db';
import { listAllCaflouProjectsForInternal } from '@/lib/caflou';

/**
 * Nabídka projektů pro doklady (zadani 8. 9. 2026: "chtel bych mit Doklady
 * navazane na projekty. Kdyz rozkliknu projekt, uvidim doklady k projektu").
 *
 * Na rozdíl od výkazů, kde jde vybrat jen rozpracovaný projekt, se tady
 * nabízejí i dokončené — faktura často odchází až potom, co je projekt hotový,
 * a přijaté doklady dobíhají ještě déle. Rozpracované jsou nahoře.
 *
 * Seznam je stejný (cachovaný) jako pro přehled Projekty, takže to nestojí
 * žádný dotaz do Caflou navíc.
 */
export type ProjectOption = {
  id: string;
  name: string;
  label: string;
  finished: boolean;
};

export async function listProjectOptions(): Promise<ProjectOption[]> {
  try {
    const companies = await prisma.company.findMany({
      where: { caflouCompanyId: { not: null } },
      select: { name: true, caflouCompanyId: true },
    });
    const { projects } = await listAllCaflouProjectsForInternal(
      companies.map((c) => ({ name: c.name, caflouCompanyId: c.caflouCompanyId! })),
    );
    return projects
      .map((p) => ({
        id: String(p.id),
        name: p.name,
        label: p.companyName ? `${p.name} — ${p.companyName}` : p.name,
        finished: p.finished,
      }))
      .sort((a, b) => Number(a.finished) - Number(b.finished) || a.label.localeCompare(b.label, 'cs'));
  } catch (err) {
    // Když Caflou nedojede, doklad se musí dát uložit i tak — jen bez projektu.
    console.error('listProjectOptions selhalo:', err);
    return [];
  }
}

/**
 * Doplní název projektu k vybranému ID. Ukládá se obojí, aby doklad zůstal
 * čitelný, i kdyby projekt v Caflou zmizel nebo se přejmenoval.
 */
export async function resolveProject(
  caflouProjectId: string | null | undefined,
): Promise<{ caflouProjectId: string | null; projectName: string | null }> {
  const id = (caflouProjectId ?? '').trim();
  if (!id) return { caflouProjectId: null, projectName: null };
  const options = await listProjectOptions();
  const found = options.find((o) => o.id === id);
  return { caflouProjectId: id, projectName: found?.name ?? null };
}
