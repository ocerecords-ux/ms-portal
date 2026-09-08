import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

// Ukoly pro vysouvaci panel na prave hrane obrazovky (zadani 8. 9. 2026).
// Nacitaji se v layoutu, aby byl panel na kazde strance portalu.

export type DockTask = { id: string; title: string; done: boolean; dueDate: string | null };

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
    }));
  } catch (err) {
    // Databaze bez tabulky Task (jeste nedobehl `prisma db push`) nesmi
    // shodit cely portal - panel se proste nezobrazi.
    console.error('Nacteni ukolu selhalo:', err);
    return [];
  }
}
