import { prisma } from '@/lib/db';
import { nazevProjektuVelky } from '@/lib/nazevProjektu';

/**
 * KANÁL PROJEKTU V CHATU (zadání 17. 9. 2026: „potřebuji, ať se založí rovnou
 * při založení projektu i kanál").
 *
 * Do teď kanál vznikal dvěma způsoby: sám u projektu z objednávky a jinak až
 * ve chvíli, kdy na projekt někdo v chatu poprvé klepl. Projekt založený
 * ručně tak kanál neměl - a dokud ho nikdo neotevřel, neměl ho kam napsat ani
 * Bruno.
 *
 * Jedno místo pro obojí: /api/admin/projekty i /api/orders volají tuhle
 * funkci, takže se ty dvě cesty nemůžou rozejít.
 *
 * KDO VIDÍ: kanály projektů jsou pro celý tým (viz lib/chatServer.ts), členství
 * se zakládá jen zakladateli a manažerovi - aby jim v něm chodila upozornění
 * bez toho, že by kanál museli nejdřív otevřít. ZVUKAŘ kanál k projektu
 * „V přípravě" nevidí; řeší se to při výpisu podle stavu projektu, ne tím, že
 * by kanál neexistoval.
 */
export async function zalozKanalProjektu(vstup: {
  caflouProjectId: string;
  nazev: string;
  /** Kdo projekt zakládá. */
  zakladatelId: string;
  /** Manažer projektu, když je vyplněný. */
  managerUserId?: string | null;
}): Promise<void> {
  const { caflouProjectId, nazev, zakladatelId, managerUserId } = vstup;
  try {
    const uz = await prisma.conversation.findUnique({
      where: { caflouProjectId },
      select: { id: true },
    });
    if (uz) return;

    const clenove = Array.from(new Set([zakladatelId, managerUserId].filter(Boolean) as string[]));

    await prisma.conversation.create({
      data: {
        kind: 'PROJEKT',
        name: nazevProjektuVelky(nazev),
        caflouProjectId,
        createdById: zakladatelId,
        members: { create: clenove.map((userId) => ({ userId })) },
      },
    });
  } catch (err) {
    // Kanál je doprovodná věc - projekt kvůli němu nesmí spadnout.
    console.error('Kanál projektu se nepodařilo založit:', err);
  }
}
