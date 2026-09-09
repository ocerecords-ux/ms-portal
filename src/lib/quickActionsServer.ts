import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  defaultQuickActionKeys,
  findQuickAction,
  type QuickAction,
} from '@/lib/quickActions';

// Serverova cast rychlych voleb (zadani 9. 9. 2026) - oddelena od
// lib/quickActions.ts, protoze katalog odtamtud pouziva i klientsky panel
// a Prisma se do prohlizece dostat nesmi.
//
// Panel je NA KAZDEHO UZIVATELE ZVLAST, stejne jako horni lista.

/**
 * Rychle volby prihlaseneho uzivatele. Kdyz si panel jeste neupravoval,
 * dostane vychozi sadu podle role - nikam se nic nezaklada, takze cerstvy
 * ucet nema v databazi zadny radek a porad vidi aktualni vychozi sadu.
 *
 * Akce, na kterou uzivatel nema pravo, se vyfiltruje i kdyby ji v databazi
 * mel (napr. po zmene role).
 */
export async function loadQuickActions(userId: string, role: Role): Promise<QuickAction[]> {
  try {
    const rows = await prisma.userQuickAction.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }],
    });
    if (rows.length > 0) {
      return rows
        .map((r) => findQuickAction(r.actionKey))
        .filter((a): a is QuickAction => Boolean(a) && a!.roles.includes(role));
    }
  } catch (err) {
    // Databaze bez tabulky UserQuickAction (jeste nedobehl `prisma db push`)
    // nesmi shodit portal - panel proste zustane ve vychozim stavu.
    console.error('Nacteni rychlych voleb selhalo, pouzivam vychozi:', err);
  }

  return defaultQuickActionKeys(role)
    .map((key) => findQuickAction(key))
    .filter((a): a is QuickAction => Boolean(a) && a!.roles.includes(role));
}
