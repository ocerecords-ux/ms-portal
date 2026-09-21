import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

// Ukoly pro vysouvaci panel na prave hrane obrazovky (zadani 8. 9. 2026).
// Nacitaji se v layoutu, aby byl panel na kazde strance portalu.

export type DockTask = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  /** Čas termínu „HH:MM" (21. 9. 2026); null = do konce dne. */
  dueTime: string | null;
  /** Kdo úkol zadal z chatu přes @úkol (zadání 18. 9. 2026); null = já sám. */
  zadalJmeno: string | null;
};

/**
 * Ukoly prihlaseneho uzivatele. Klientum a hercum se panel nezobrazuje, takze
 * se pro ne nic nenacita. Ukol se hleda vzdy podle userId ze session - cizi
 * ukoly se nikam nedostanou.
 */
export async function loadMyTasks(userId: string, role: Role): Promise<DockTask[]> {
  if (!isInternalRole(role)) return [];
  try {
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: [{ done: 'asc' }, { dueDate: 'asc' }, { sortOrder: 'asc' }],
      take: 200,
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      done: t.done,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      dueTime: t.dueTime ?? null,
      zadalJmeno: t.zadalJmeno ?? null,
    }));
  } catch (err) {
    // Databaze bez tabulky Task (jeste nedobehl `prisma db push`) nesmi
    // shodit cely portal - panel se proste nezobrazi.
    console.error('Nacteni ukolu selhalo:', err);
    return [];
  }
}

/**
 * ÚKOLY, KTERÉ JSEM ZADAL JÁ (zadání 21. 9. 2026: „když vytvořím někomu
 * dalšímu úkol z chatu, potřebuji vidět někde, že jsem ho vytvořil a že ho
 * pak ten člověk splnil").
 *
 * Jen úkoly pro JINÉ lidi - co si člověk zadal sám sobě, má ve svém seznamu.
 */
export type ZadanyUkol = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  dueTime: string | null;
  /** Kdy ho příjemce odškrtl (ISO), u starších splněných null. */
  splnenoAt: string | null;
  /** Komu úkol patří. */
  komu: string;
  zadanoAt: string;
  /** Konverzace, ze které úkol vznikl. */
  zdrojKonverzaceId: string | null;
};

export async function loadZadaneMnou(userId: string, role: Role): Promise<ZadanyUkol[]> {
  if (!isInternalRole(role)) return [];
  try {
    const tasks = await prisma.task.findMany({
      where: { zadalId: userId, NOT: { userId } },
      // Otevřené napřed, pak nejčerstvěji splněné.
      orderBy: [{ done: 'asc' }, { splnenoAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      done: t.done,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      dueTime: t.dueTime ?? null,
      splnenoAt: t.splnenoAt ? t.splnenoAt.toISOString() : null,
      komu: t.user?.name || t.user?.email || '—',
      zadanoAt: t.createdAt.toISOString(),
      zdrojKonverzaceId: t.zdrojKonverzaceId ?? null,
    }));
  } catch (err) {
    // Sloupec zadalId ještě nemusí být v databázi (nedoběhl db push).
    console.error('Nacteni zadanych ukolu selhalo:', err);
    return [];
  }
}
