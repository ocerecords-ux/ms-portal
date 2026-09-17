import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * KDO SMÍ DO SEKCE BANKA (zadání 17. 9. 2026: „nastavení a párování banky bych
 * měl vidět jen já a Bára Šiblová").
 *
 * Pohyby na účtu jsou citlivější než zbytek dokladů, takže nestačí být
 * Žůžo-labůžo - účet to musí mít dovolené příznakem `vidiBanku` (zaškrtává se
 * v Adminu ▸ Uživatelé). Je to příznak u účtu, ne seznam jmen v kódu: lidi se
 * mění a kód by o tom nevěděl.
 *
 * DOKUD NENÍ OZNAČENÝ NIKDO, vidí sekci Žůžo-labůžo - stejně jako u manažerů
 * projektu (viz lib/manazeriServer.ts). Bez toho by po nasazení nevidělo
 * záložku vůbec nikoho a nebylo by kde si příznak zapnout. Jakmile si ho
 * někdo zaškrtne, sekce se zavře na něj a na ty, kdo ho mají taky.
 */
export type PristupKBance = {
  /** Vidí sekci? */
  smi: boolean;
  /** Je otevřená jen proto, že příznak nemá zaškrtnutý nikdo? */
  otevrenaVsem: boolean;
};

export async function pristupKBance(): Promise<PristupKBance> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { smi: false, otevrenaVsem: false };

  const [uzivatel, oznacenych] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { active: true, role: true, vidiBanku: true },
    }),
    prisma.user.count({ where: { active: true, vidiBanku: true } }),
  ]);

  if (!uzivatel?.active) return { smi: false, otevrenaVsem: false };
  if (uzivatel.vidiBanku) return { smi: true, otevrenaVsem: false };

  // Nikdo označený není - ať se aspoň Žůžo-labůžo dostane dovnitř a může to
  // nastavit. Stránka na to sama upozorní.
  if (oznacenych === 0 && uzivatel.role === 'ADMIN') return { smi: true, otevrenaVsem: true };

  return { smi: false, otevrenaVsem: false };
}

export async function smiDoBanky(): Promise<boolean> {
  return (await pristupKBance()).smi;
}
