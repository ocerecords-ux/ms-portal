import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * KDO SMÍ DO SEKCE POKLADNA (zadání 23. 10. 2026: pokladnu mám vidět jen já
 * a Barbora Šiblová).
 *
 * Totéž pravidlo jako u Banky (lib/bankaPristup.ts): hotovost je citlivější
 * než zbytek dokladů, takže nestačí být Žůžo-labůžo - účet to musí mít
 * dovolené příznakem `vidiPokladnu` (zaškrtává se v Adminu ▸ Uživatelé).
 * Je to příznak u účtu, ne seznam jmen v kódu: lidi se mění a kód by o tom
 * nevěděl.
 *
 * PŘI NASAZENÍ SE PŘÍZNAK ZAPNE TĚM, KDO UŽ VIDÍ BANKU (seed) - jsou to
 * titíž dva lidi a nikdo nemusí nic doklikávat. Dál už si žije svým životem.
 *
 * DOKUD NENÍ OZNAČENÝ NIKDO, vidí sekci Žůžo-labůžo. Bez toho by po nasazení
 * do prázdné databáze nevidělo záložku vůbec nikoho a nebylo by kde si
 * příznak zapnout.
 */
export type PristupKPokladne = {
  /** Vidí sekci? */
  smi: boolean;
  /** Je otevřená jen proto, že příznak nemá zaškrtnutý nikdo? */
  otevrenaVsem: boolean;
};

export async function pristupKPokladne(): Promise<PristupKPokladne> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { smi: false, otevrenaVsem: false };

  const [uzivatel, oznacenych] = await Promise.all([
    prisma.user
      .findUnique({
        where: { id: session.user.id },
        select: { active: true, role: true, vidiPokladnu: true },
      })
      .catch(() => null),
    prisma.user.count({ where: { active: true, vidiPokladnu: true } }).catch(() => 0),
  ]);

  if (!uzivatel?.active) return { smi: false, otevrenaVsem: false };
  if (uzivatel.vidiPokladnu) return { smi: true, otevrenaVsem: false };

  if (oznacenych === 0 && uzivatel.role === 'ADMIN') return { smi: true, otevrenaVsem: true };

  return { smi: false, otevrenaVsem: false };
}

export async function smiDoPokladny(): Promise<boolean> {
  return (await pristupKPokladne()).smi;
}
