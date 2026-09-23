import { prisma } from '@/lib/db';

/**
 * POZNÁMKY U PROJEKTU (zadání 23. 9. 2026: „udělal bych u projektu taky
 * v detailu Poznámky, kde se bude dát vložit poznámka. Primárně bych tam
 * propisoval i poznámky z objednávek").
 *
 * Jeden blok na projektu, kam si tým píše, co se k zakázce hodí vědět a co
 * nepatří do žádné kolonky - kdo z klienta co chtěl telefonem, na co si dát
 * u herce pozor, proč se termín posunul.
 *
 * POZNÁMKA Z OBJEDNÁVKY SE NEKOPÍRUJE, ČTE SE. Je to text, který napsal
 * klient - kdyby se při založení projektu jednou opsal do vlastního záznamu,
 * od té chvíle by žil vlastním životem a nikdo by nepoznal, jestli sedí.
 * Takhle je vždycky přesně to, co v objednávce stojí, a funguje to zpětně
 * i u zakázek přijatých dřív, než tohle vzniklo.
 *
 * KDO JE VIDÍ: Žůžo-labůžo a produkce (canEditProjectMeta). Zvukař ne - má
 * detail projektu jen ke čtení a tohle jsou naše vnitřní věci.
 */

export type PoznamkaProjektu = {
  id: string;
  text: string;
  autorJmeno: string;
  autorId: string | null;
  kdy: string;
  /** Z objednávky se nemaže ani neupravuje - patří klientovi. */
  zObjednavky: boolean;
};

/** Poznámka klienta z objednávky, ze které projekt vznikl (nebo nic). */
async function poznamkaZObjednavky(caflouProjectId: string): Promise<PoznamkaProjektu | null> {
  try {
    const objednavka = await prisma.order.findFirst({
      where: { caflouProjectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        note: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    });
    const text = objednavka?.note?.trim();
    if (!objednavka || !text) return null;
    return {
      id: `objednavka-${objednavka.id}`,
      text,
      autorJmeno: objednavka.createdBy?.name || objednavka.createdBy?.email || 'klient',
      autorId: null,
      kdy: objednavka.createdAt.toISOString(),
      zObjednavky: true,
    };
  } catch (err) {
    console.error('Cteni poznamky z objednavky selhalo:', err);
    return null;
  }
}

/** Všechny poznámky projektu, nejnovější první; z objednávky vždy nakonec. */
export async function nactiPoznamkyProjektu(caflouProjectId: string): Promise<PoznamkaProjektu[]> {
  const [zObjednavky, vlastni] = await Promise.all([
    poznamkaZObjednavky(caflouProjectId),
    prisma.poznamkaProjektu
      .findMany({ where: { caflouProjectId }, orderBy: { createdAt: 'desc' } })
      .catch((err: unknown) => {
        console.error('Cteni poznamek projektu selhalo:', err);
        return [] as Awaited<ReturnType<typeof prisma.poznamkaProjektu.findMany>>;
      }),
  ]);

  const nase: PoznamkaProjektu[] = vlastni.map((p) => ({
    id: p.id,
    text: p.text,
    autorJmeno: p.autorJmeno,
    autorId: p.autorId,
    kdy: p.createdAt.toISOString(),
    zObjednavky: false,
  }));

  // Objednávka je nejstarší věc na projektu, takže sedí na konec seznamu -
  // nahoře má být to, co někdo napsal teď.
  return zObjednavky ? [...nase, zObjednavky] : nase;
}
