import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { ALL_ROLES, DEFAULT_MENU_ITEMS } from '@/lib/menu';

// Sprava polozek horni listy (zadani 6. 9. 2026). Meni je jen Zuzo-labuzo.
//
// PUT uklada cely seznam najednou - editor v adminu pracuje s celym menu, ne
// s jednotlivymi radky, takze i poradi a mazani projde jednim pozadavkem.
const itemSchema = z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1, 'Název položky nesmí být prázdný.').max(40, 'Název je moc dlouhý.'),
  href: z
    .string()
    .trim()
    .min(1, 'Vyplňte, kam odkaz vede.')
    .max(300)
    .refine((v) => v.startsWith('/') || /^https?:\/\/\S+$/i.test(v), {
      message: 'Odkaz musí začínat lomítkem (stránka portálu) nebo http(s)://.',
    }),
  roles: z.array(z.enum(ALL_ROLES)).min(1, 'U každé položky vyberte aspoň jednu roli.'),
  visible: z.boolean(),
});

const schema = z.object({ items: z.array(itemSchema).max(30, 'Do lišty se vejde nejvýš 30 položek.') });

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const items = parsed.data.items;

    const keepIds = items.map((i) => i.id).filter((id): id is string => Boolean(id));

    await prisma.$transaction([
      prisma.menuItem.deleteMany({ where: { id: { notIn: keepIds } } }),
      ...items.map((item, index) => {
        const data = {
          label: item.label,
          href: item.href,
          roles: item.roles,
          visible: item.visible,
          sortOrder: (index + 1) * 10,
        };
        return item.id
          ? prisma.menuItem.update({ where: { id: item.id }, data })
          : prisma.menuItem.create({ data });
      }),
    ]);

    return NextResponse.json({ ok: true, count: items.length });
  } catch (err) {
    console.error('PUT /api/admin/menu selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/** Obnoveni vychoziho menu - smaze uprav a vrati puvodni sadu odkazu. */
export async function POST() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    await prisma.$transaction([
      prisma.menuItem.deleteMany({}),
      prisma.menuItem.createMany({ data: DEFAULT_MENU_ITEMS }),
    ]);

    return NextResponse.json({ ok: true, count: DEFAULT_MENU_ITEMS.length });
  } catch (err) {
    console.error('POST /api/admin/menu selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Obnovení se nezdařilo (${message}).` }, { status: 500 });
  }
}
