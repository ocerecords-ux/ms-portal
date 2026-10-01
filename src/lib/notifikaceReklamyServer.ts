import { prisma } from '@/lib/db';

/**
 * VÝCHOZÍ NOTIFIKACE U FIREM, PRO KTERÉ DĚLÁME REKLAMU (zadání 1. 10. 2026:
 * „nastav u všech firem, pro které děláme reklamu, defaultně notifikaci jen
 * při stavu dokončeno-ke schválení").
 *
 * U reklamy je jediný okamžik, kdy má klientovi něco přijít: spot je hotový
 * a čeká na jeho schválení. Zprávy o natáčení a střihu ho nezajímají — spot
 * se udělá za den a dvě zprávy o jedné zakázce čte jako spam.
 *
 * STAV, NE OKAMŽIK: posílá se podle stavu projektu, viz lib/notifikaceFirmy.ts.
 * Název stavu je text, musí sedět přesně na STAVY_S_NOTIFIKACI.
 */
export const STAV_KE_SCHVALENI = 'Dokončeno - ke schválení';

/**
 * Zapne firmě zprávu klientovi u „Dokončeno - ke schválení".
 *
 * `jenReklama` (firma, která dělá reklamu a ne audioknihy) dostane i úklid:
 * u ostatních stavů se zpráva vypne, takže zůstane opravdu JEN tahle jedna.
 * U firmy, která dělá obojí, se nic jiného nemaže — její audioknihová
 * nastavení jsou její věc a zadání se jich netýká.
 */
export async function vychoziNotifikaceReklamy(
  companyId: string,
  jenReklama: boolean,
): Promise<void> {
  await prisma.notifikaceFirmy.upsert({
    where: { companyId_stav: { companyId, stav: STAV_KE_SCHVALENI } },
    update: { komu: 'KLIENT' },
    create: { companyId, stav: STAV_KE_SCHVALENI, komu: 'KLIENT' },
  });

  if (!jenReklama) return;
  await prisma.notifikaceFirmy.updateMany({
    where: { companyId, stav: { not: STAV_KE_SCHVALENI } },
    data: { komu: 'NIKAM' },
  });
}
