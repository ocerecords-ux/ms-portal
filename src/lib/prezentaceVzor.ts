import { prisma } from '@/lib/db';

/**
 * VZOR TEXTŮ PREZENTACE (11. 10. 2026). Držíme JEDEN výchozí - víc vzorů by
 * znamenalo rozhodovat při každé nabídce, který vzít, a to u podmínek
 * spolupráce nedává smysl. Kdyby jich bylo potřeba víc, model to unese.
 */

const NAZEV = 'Výchozí';

export async function nactiVzorPrezentace() {
  return prisma.vzorPrezentace
    .findFirst({
      where: { active: true },
      orderBy: [{ vychozi: 'desc' }, { poradi: 'asc' }],
      select: { id: true, navrhReseni: true, podminky: true },
    })
    .catch(() => null);
}

export async function ulozVzorPrezentace(data: {
  navrhReseni: string | null;
  podminky: string | null;
}): Promise<boolean> {
  try {
    const stary = await nactiVzorPrezentace();
    if (stary) {
      await prisma.vzorPrezentace.update({ where: { id: stary.id }, data });
    } else {
      await prisma.vzorPrezentace.create({
        data: { nazev: NAZEV, vychozi: true, ...data },
      });
    }
    return true;
  } catch (err) {
    console.error('Vzor prezentace se nepodařilo uložit:', err);
    return false;
  }
}
