import { prisma } from '@/lib/db';
import { DEFAULT_BUDGET_SETTINGS, computeBudget } from '@/lib/budget';
import { durationMinutes, formatCzk } from '@/lib/timesheets';
import { notify, notifyMany } from '@/lib/notifications';
import { sendBonusEmail } from '@/lib/email';
import { jeZapnuto } from '@/lib/oznameniServer';

/**
 * BONUS ZVUKAŘE ZA AUDIOKNIHU (zadání 15. 9. 2026: „aby nám portál
 * automaticky navrhnul schválení bonusu pro zvukaře u audioknih. Podmínka
 * získání bonusu je ta, že zvukař má na audioknize ve střihu splněno alespoň
 * 90 % v rámci celého střihu… Děje se to ale až ve chvíli, kdy přehodíme stav…").
 *
 * KDY: při PRVNÍM překlopení projektu do stavu „Dokončeno - ke schválení"
 * (upřesnění 15. 9. 2026). Do té chvíle se podíl mění s každým výkazem;
 * kdyby portál navrhoval průběžně, nabízel by bonus tomu, kdo měl zrovna
 * odpracováno nejvíc, a bral by mu ho, jakmile si kolega dopsal odpoledne.
 * U projektu, který je už ukončený, se bonus neřeší — zpětně se nic
 * nedohání.
 *
 * PORTÁL NIC NEPŘIZNÁVÁ SÁM. Vyrobí NÁVRH; přiznat ho musí člověk
 * v záložce Bonusy ke schválení. Bonus jsou peníze - automat, který je
 * rozdává bez kontroly, je horší než žádný automat.
 */

/** Kolik procent střihu musí zvukař udělat, aby na bonus dosáhl. */
export const PODIL_PRO_BONUS = 90;

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
 * NÁROK NA BONUS SE MŮŽE ZTRATIT ZPĚTNĚ (zadání 15. 10. 2026: „teď se nám
 * stalo, že Peter včera překlopil projekt do dokončeno ke schválení a zvukař
 * si tam pak dnes ještě zapsal dodatečně výkaz a tím pádem na ten bonus nemá
 * nárok. Takže by to mělo nějak zařvat a navrhnout stornovat bonus").
 *
 * Návrh bonusu vzniká JEDNOU, při překlopení stavu - viz výš. Jenže výkazy se
 * dopisují i potom, a každý dopsaný střih kolegy sníží podíl toho, kdo bonus
 * dostal. Portál to proto po každém zásahu do výkazů přepočítá a když podíl
 * spadne pod hranici, ŘEKNE TO - sám nic neruší. Storno je rozhodnutí
 * člověka, stejně jako přiznání.
 */

/** Aktuální podíl na střihu podle výkazů, které jsou v portálu teď. */
export async function podilyNaStrihu(
  caflouProjectId: string,
): Promise<Map<string, { minut: number; celkem: number; podil: number }>> {
  const vysledek = new Map<string, { minut: number; celkem: number; podil: number }>();
  const vykazy = await prisma.timesheetEntry
    .findMany({
      where: { caflouProjectId, workType: 'EDITING' },
      select: { userId: true, startMinutes: true, endMinutes: true },
    })
    .catch(() => [] as { userId: string; startMinutes: number; endMinutes: number }[]);
  if (vykazy.length === 0) return vysledek;

  const minuty = new Map<string, number>();
  let celkem = 0;
  for (const v of vykazy) {
    const minut = durationMinutes(v.startMinutes, v.endMinutes);
    minuty.set(v.userId, (minuty.get(v.userId) ?? 0) + minut);
    celkem += minut;
  }
  if (celkem <= 0) return vysledek;

  for (const [userId, minut] of minuty) {
    vysledek.set(userId, { minut, celkem, podil: Math.round((minut / celkem) * 100) });
  }
  return vysledek;
}

/**
 * Přepočítá bonusy projektu a u těch, kterým podíl spadl pod hranici, zapíše
 * nový podíl a jednou upozorní Žůžo-labůžo.
 *
 * NIKDY NEVYHAZUJE a nic neruší: volá se ze zápisu výkazu, což je to hlavní,
 * co ten člověk zrovna dělá.
 *
 * Ručně přidaný bonus se nehlídá - ten se podle výkazů nepočítal, takže mu
 * nemá co spadnout.
 */
export async function zkontrolujNarokNaBonusy(caflouProjectId: string): Promise<void> {
  try {
    const bonusy = await prisma.bonusZvukare.findMany({
      where: {
        caflouProjectId,
        rucne: false,
        stav: { in: ['NAVRZENO', 'SCHVALENO'] },
      },
      select: { id: true, userId: true, stav: true, projectName: true, castka: true, podilProcent: true, narokPadlAt: true },
    });
    if (bonusy.length === 0) return;

    const podily = await podilyNaStrihu(caflouProjectId);

    for (const bonus of bonusy) {
      const ted = podily.get(bonus.userId);
      const podil = ted?.podil ?? 0;

      if (podil >= PODIL_PRO_BONUS) {
        // Nárok se vrátil (kolega si výkaz smazal) - příznak pryč, ať
        // v seznamu nesvítí varování, které už neplatí.
        if (bonus.narokPadlAt) {
          await prisma.bonusZvukare.update({
            where: { id: bonus.id },
            data: { narokPadlAt: null, podilPoZmeneProcent: null },
          });
        }
        continue;
      }

      await prisma.bonusZvukare.update({
        where: { id: bonus.id },
        data: { podilPoZmeneProcent: podil, narokPadlAt: bonus.narokPadlAt ?? new Date() },
      });

      // Upozorní se JEDNOU. Každý další dopsaný výkaz jen posune číslo;
      // druhý zvoneček o tomtéž už nikomu nic neřekne.
      if (bonus.narokPadlAt) continue;

      const zvukar = await prisma.user.findUnique({
        where: { id: bonus.userId },
        select: { name: true, email: true },
      });
      const schvalovaci = await prisma.user.findMany({
        where: { role: 'ADMIN', active: true },
        select: { id: true },
      });
      const nazev = bonus.projectName || `Projekt ${caflouProjectId}`;
      const kdo = zvukar?.name || zvukar?.email || 'zvukař';
      const uzSchvaleny = bonus.stav === 'SCHVALENO';

      await notifyMany(
        schvalovaci.map((u) => u.id),
        {
          kind: 'BONUS_NAROK_PADL',
          title: `${uzSchvaleny ? 'Schválený bonus' : 'Navržený bonus'} už nemá nárok — ${nazev}`,
          body:
            `${kdo}: podíl na střihu klesl z ${bonus.podilProcent} % na ${podil} % ` +
            `(hranice je ${PODIL_PRO_BONUS} %). Přibyl výkaz po navržení bonusu — ` +
            `${uzSchvaleny ? 'bonus je potřeba stornovat' : 'návrh je potřeba zamítnout'}.`,
          url: '/vykazy?zalozka=bonusy',
        },
      );
    }
  } catch (err) {
    console.error(`Kontrola nároku na bonusy u projektu ${caflouProjectId} selhala:`, err);
  }
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

/**
 * Zvukař se má o schváleném bonusu dozvědět (zadání 15. 9. 2026: „měla by
 * tomu danému zvukaři přijít notifikace, že bonus byl schválen").
 *
 * Dvěma cestami: zvonek v portálu a e-mail. NIKDY NEVYHAZUJE - bonus je už
 * schválený a uložený; kdyby rozeslání shodilo odpověď, vypadalo by to, že
 * se schválení nepovedlo.
 */
export async function oznamSchvalenyBonus(bonusId: string): Promise<void> {
  try {
    const bonus = await prisma.bonusZvukare.findUnique({
      where: { id: bonusId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!bonus || bonus.stav !== 'SCHVALENO') return;
    // Zprava se da vypnout v Administraci → Zpravy portalu (zadani 15. 9. 2026).
    if (!(await jeZapnuto('BONUS_SCHVALEN'))) return;

    const nazev = bonus.projectName || `Projekt ${bonus.caflouProjectId}`;
    const castka = formatCzk(bonus.castka);
    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const odkaz = `${zaklad}/vykazy?zalozka=bonusy`;

    await notify({
      userId: bonus.userId,
      kind: 'BONUS_SCHVALEN',
      title: `Schválený bonus — ${nazev}`,
      body: `${castka}${bonus.poznamka ? ` · ${bonus.poznamka}` : ''}`,
      url: '/vykazy?zalozka=bonusy',
    });

    if (bonus.user.email) {
      const vysledek = await sendBonusEmail({
        to: bonus.user.email,
        projekt: nazev,
        castka,
        podilProcent: bonus.rucne ? 0 : bonus.podilProcent,
        poznamka: bonus.poznamka,
        schvalil: bonus.rozhodlJmeno,
        odkaz,
      });
      if (!vysledek.sent) {
        console.error(`Mail o bonusu ${bonusId} neodešel: ${vysledek.reason}`);
      }
    }
  } catch (err) {
    console.error(`Oznámení o bonusu ${bonusId} selhalo:`, err);
  }
}
