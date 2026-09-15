import { prisma } from '@/lib/db';
import { DEFAULT_BUDGET_SETTINGS, computeBudget } from '@/lib/budget';
import { durationMinutes } from '@/lib/timesheets';

/**
 * BONUS ZVUKAŘE ZA AUDIOKNIHU (zadání 15. 9. 2026: „aby nám portál
 * automaticky navrhnul schválení bonusu pro zvukaře u audioknih. Podmínka
 * získání bonusu je ta, že zvukař má na audioknize ve střihu splněno alespoň
 * 90 % v rámci celého střihu… Děje se to ale až ve chvíli, kdy přehodíme stav
 * na Schváleno - k fakturaci").
 *
 * PROČ AŽ PŘI PŘEHOZENÍ STAVU: dokud se stříhá, podíl se mění s každým
 * výkazem. Kdyby portál navrhoval průběžně, nabízel by bonus někomu, kdo
 * měl zrovna odpracováno nejvíc, a bral by mu ho, jakmile si kolega dopsal
 * odpoledne. V okamžiku schválení nahrávek je střih hotový a čísla platí.
 *
 * PORTÁL NIC NEPŘIZNÁVÁ SÁM. Vyrobí NÁVRH; přiznat ho musí člověk
 * v záložce Bonusy ke schválení. Bonus jsou peníze - automat, který je
 * rozdává bez kontroly, je horší než žádný automat.
 */

/** Kolik procent střihu musí zvukař udělat, aby na bonus dosáhl. */
export const PODIL_PRO_BONUS = 90;

/**
 * Stavy, ve kterých je kniha hotová a bonus má smysl řešit. „Vyfakturováno"
 * je tu kvůli knihám, které mezitím prošly dál - viz prepoctiBonusyHotovych.
 */
export const STAVY_S_BONUSEM = ['Schváleno - k fakturaci', 'Vyfakturováno'] as const;

/**
 * Projde projekt a na každého zvukaře, který splnil podmínku, založí návrh
 * bonusu. Vrací, kolik návrhů přibylo.
 *
 * NIKDY NEVYHAZUJE: volá se z přehození stavu projektu, a to je hlavní věc,
 * kterou člověk dělá. Kdyby ho shodil výpočet bonusu, byla by to ta horší
 * varianta - chyba jde do logu.
 */
export async function navrhniBonusyZaProjekt(caflouProjectId: string): Promise<number> {
  try {
    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        name: true,
        pageCount: true,
        company: { select: { dealsAudiobooks: true } },
      },
    });
    // Bonus je vec AUDIOKNIHY. Poznava se stejne jako rozpocet na strance
    // projektu: firma dela audioknihy a projekt ma normostrany.
    if (!projekt?.company?.dealsAudiobooks) return 0;
    const normostran = projekt.pageCount ?? 0;
    if (normostran <= 0) return 0;

    const nastaveni = await prisma.budgetSettings.findUnique({ where: { id: 'default' } });
    const rozpocet = computeBudget(normostran, nastaveni ?? DEFAULT_BUDGET_SETTINGS);
    if (rozpocet.bonus <= 0) return 0;

    // Strih na projektu - kdo kolik odpracoval. Nataceni se nepocita:
    // podminka mluvi vyslovne o podilu „v ramci celeho strihu".
    const vykazy = await prisma.timesheetEntry.findMany({
      where: { caflouProjectId, workType: 'EDITING' },
      select: { userId: true, startMinutes: true, endMinutes: true },
    });
    if (vykazy.length === 0) return 0;

    const minutyPodleZvukare = new Map<string, number>();
    let minutCelkem = 0;
    for (const v of vykazy) {
      const minut = durationMinutes(v.startMinutes, v.endMinutes);
      minutyPodleZvukare.set(v.userId, (minutyPodleZvukare.get(v.userId) ?? 0) + minut);
      minutCelkem += minut;
    }
    if (minutCelkem <= 0) return 0;

    let pribylo = 0;
    for (const [userId, minut] of minutyPodleZvukare) {
      const podil = Math.round((minut / minutCelkem) * 100);
      if (podil < PODIL_PRO_BONUS) continue;

      // Uz navrzeny (nebo rozhodnuty) bonus se neopakuje - klic je dvojice
      // projekt + zvukar, takze si s tim poradi i opakovane prehozeni stavu.
      const uz = await prisma.bonusZvukare.findUnique({
        where: { caflouProjectId_userId: { caflouProjectId, userId } },
        select: { id: true },
      });
      if (uz) continue;

      await prisma.bonusZvukare.create({
        data: {
          caflouProjectId,
          projectName: projekt.name,
          userId,
          castka: rozpocet.bonus,
          podilProcent: podil,
          minutZvukare: minut,
          minutCelkem,
        },
      });
      pribylo += 1;
    }

    return pribylo;
  } catch (err) {
    console.error(`Návrh bonusů u projektu ${caflouProjectId} selhal:`, err);
    return 0;
  }
}

/**
 * Projde VŠECHNY hotové audioknihy a doplní chybějící návrhy.
 *
 * Proč to tu je: návrh vzniká při přehození stavu, takže knihy schválené
 * dřív, než tahle funkce existovala, by bonus nedostaly nikdy. Tohle je
 * dožene. Spouští se ručně tlačítkem v záložce Bonusy - nic nepřepisuje,
 * jen zakládá to, co chybí.
 */
export async function prepoctiBonusyHotovych(): Promise<{ projektu: number; pribylo: number }> {
  const projekty = await prisma.projectMeta.findMany({
    where: { statusName: { in: [...STAVY_S_BONUSEM] } },
    select: { caflouProjectId: true },
    take: 1000,
  });

  let pribylo = 0;
  for (const p of projekty) {
    pribylo += await navrhniBonusyZaProjekt(p.caflouProjectId);
  }
  return { projektu: projekty.length, pribylo };
}

/** Kolik bonusů čeká na schválení - číslo do odznaku v liště. */
export async function pocetBonusuKeSchvaleni(): Promise<number> {
  try {
    return await prisma.bonusZvukare.count({ where: { stav: 'NAVRZENO' } });
  } catch (err) {
    // Chybejici tabulka (jeste nedobehl `prisma db push`) nesmi shodit listu.
    console.error('Počet bonusů ke schválení se nepodařilo načíst:', err);
    return 0;
  }
}
