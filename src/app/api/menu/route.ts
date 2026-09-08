import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canSee } from '@/lib/menu';

// Uprava odkazu v horni liste. Kazdy si upravuje SVOJI listu (zadani
// 8. 9. 2026) - proto tu neni zadna kontrola na admina, jen prihlaseni.
// Posila se vzdy CELY seznam v poradi, jak ma vypadat.
//
// Viditelnost se tu nenastavuje: kdo co uvidi se ridi pravy ke strance
// (lib/menu.ts > PAGE_ACCESS). Odkaz na stranku, kam uzivatel nesmi, se
// proto rovnou zahodi - jinak by si ho mohl do sve listy propasovat.
const itemSchema = z.object({
  label: z.string().trim().min(1, 'Název položky nesmí být prázdný.').max(40, 'Název je moc dlouhý.'),
  href: z
    .string()
    .trim()
    .min(1, 'Vyplňte, kam odkaz vede.')
    .max(300)
    .refine((v) => v.startsWith('/') || /^https?:\/\/\S+$/i.test(v), {
      message: 'Odkaz musí začínat lomítkem (stránka portálu) nebo http(s)://.',
    }),
});

const schema = z.object({ items: z.array(itemSchema).max(30, 'Do lišty se vejde nejvýš 30 položek.') });

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const role = session.user.role;
    const items = parsed.data.items.filter((i) => canSee(i.href, role));

    await prisma.$transaction([
      prisma.userMenuItem.deleteMany({ where: { userId: session.user.id } }),
      prisma.userMenuItem.createMany({
        data: items.map((item, index) => ({
          userId: session.user.id,
          label: item.label,
          href: item.href,
          sortOrder: (index + 1) * 10,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true, count: items.length });
  } catch (err) {
    console.error('PUT /api/menu selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/** Vratit se k vychozi liste - smazeme vlastni radky a bere se sada z kodu. */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

    await prisma.userMenuItem.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/menu selhalo:', err);
    return NextResponse.json({ error: 'Obnovení se nezdařilo.' }, { status: 500 });
  }
}
