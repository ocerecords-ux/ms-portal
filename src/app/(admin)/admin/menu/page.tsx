import { prisma } from '@/lib/db';
import { ensureMenuSeeded } from '@/lib/menuServer';
import { MenuEditor } from './MenuEditor';

// Editor horni fialove listy (zadani 6. 9. 2026: "měla by být možnost si
// modifikovat odkazy nahoře v menu v horní fialové liště"). Pri prvnim
// otevreni se do databaze zapisou dosavadni napevno zadane polozky, aby bylo
// hned co upravovat a lista se nikdy nezobrazila prazdna.
export const dynamic = 'force-dynamic';

export default async function MenuAdminPage() {
  await ensureMenuSeeded();

  const items = await prisma.menuItem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Menu</h1>
        <p className="text-muted text-sm mt-1 font-body max-w-3xl">
          Odkazy v horní fialové liště. U každé položky nastavíte název, kam vede a které role ji uvidí. Pořadí měníte
          šipkami. Změny se projeví všem hned po uložení.
        </p>
      </div>

      <MenuEditor
        items={items.map((i) => ({
          id: i.id,
          label: i.label,
          href: i.href,
          roles: i.roles,
          visible: i.visible,
          sortOrder: i.sortOrder,
        }))}
      />
    </section>
  );
}
