import { prisma } from '@/lib/db';
import { INTERNAL_ROLES } from '@/lib/roles';

/**
 * Kdo se nabízí jako manažer projektu (zadání 10. 9. 2026: „manažera projektu
 * bych dal na výběr jen mě nebo Karolínu").
 *
 * Rozhoduje příznak na účtu (User.manazerProjektu), ne seznam jmen v kódu —
 * lidi se mění a kód by o tom nevěděl. Zaškrtává se na kartě uživatele.
 *
 * DOKUD NENÍ OZNAČENÝ NIKDO, nabízejí se všechny interní účty. Bez toho by
 * hned po nasazení byla nabídka prázdná a projekt by nešlo založit — a nikdo
 * by netušil proč.
 */
export type ManazerVolba = { id: string; label: string };

export async function nabidkaManazeru(): Promise<ManazerVolba[]> {
  const zvoleni = await prisma.user.findMany({
    where: { role: { in: INTERNAL_ROLES }, active: true, manazerProjektu: true },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
  if (zvoleni.length > 0) {
    return zvoleni.map((u) => ({ id: u.id, label: u.name || u.email }));
  }

  const vsichni = await prisma.user.findMany({
    where: { role: { in: INTERNAL_ROLES }, active: true },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
  return vsichni.map((u) => ({ id: u.id, label: u.name || u.email }));
}

/**
 * Smí být tenhle účet uložený jako manažer projektu?
 *
 * Volnější než nabídka: projekt, který manažera dostal dřív, o něj nemá
 * přijít jen proto, že se nabídka zúžila. Kontroluje se proto jen to, že je
 * to interní účet.
 */
export async function jeMozneUlozitManazera(userId: string): Promise<boolean> {
  const ucet = await prisma.user.findFirst({
    where: { id: userId, role: { in: INTERNAL_ROLES } },
    select: { id: true },
  });
  return Boolean(ucet);
}
