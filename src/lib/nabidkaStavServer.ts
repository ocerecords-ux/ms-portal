import { prisma } from '@/lib/db';
import { stavNabidky, type StavNabidky } from '@/lib/nabidkaReklamy';

/**
 * STAV NABÍDKY U REKLAMY SRAŽENÝ S DOKLADY (zadání 25. 9. 2026: „když dám
 * schválit nabídku ručně, tak je taky prostě schválená").
 *
 * Značka u projektu vznikla jako ruční - nabídky na reklamy chodí mailem mimo
 * portál a portál se o jejich osudu nemá odkud dozvědět. Jenže když nabídka
 * V PORTÁLU je a někdo ji schválí (klient odkazem nebo my ručně u dokladu),
 * je nesmysl, aby u projektu dál svítilo „čeká na schválení". Doklad ví víc
 * než značka, tak má přednost.
 *
 * Pořadí: schválená nabídka v portálu → SCHVÁLENA. Odmítnutá (a žádná jiná
 * schválená) → NESCHVÁLENA. Jinak platí ruční značka.
 *
 * Počítá se to při čtení, ne zápisem do ProjectMeta: značka i doklad se dají
 * měnit z několika míst a dopočet je vždycky pravdivý - i u projektů, které
 * vznikly dřív, než tohle existovalo.
 */
export async function stavyNabidekZDokladu(
  caflouProjectIds: string[],
): Promise<Map<string, StavNabidky>> {
  const vysledek = new Map<string, StavNabidky>();
  const ids = Array.from(new Set(caflouProjectIds.filter(Boolean)));
  if (ids.length === 0) return vysledek;

  const nabidky = await prisma.offer
    .findMany({
      where: { caflouProjectId: { in: ids }, status: { in: ['APPROVED', 'REJECTED'] } },
      select: { caflouProjectId: true, status: true },
    })
    .catch(() => []);

  for (const n of nabidky) {
    if (!n.caflouProjectId) continue;
    // Schválená přebíjí odmítnutou: z jedné zakázky může viset víc nabídek
    // a stačí, když je odsouhlasená jedna z nich.
    if (n.status === 'APPROVED') vysledek.set(n.caflouProjectId, 'SCHVALENA');
    else if (!vysledek.has(n.caflouProjectId)) vysledek.set(n.caflouProjectId, 'NESCHVALENA');
  }

  return vysledek;
}

/** Ruční značka a doklad dohromady - doklad vyhrává. */
export function slozStavNabidky(
  rucni: string | null | undefined,
  zDokladu: StavNabidky | undefined,
): StavNabidky {
  return zDokladu ?? stavNabidky(rucni);
}
