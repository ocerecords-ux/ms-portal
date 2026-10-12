import { prisma } from '@/lib/db';
import { jeUkol, nazevUkolu } from '@/lib/ukolyZChatu';
import { notify } from '@/lib/notifications';
import { minutesInZone, minutesToTime, utcParts } from '@/lib/calendar';

/**
 * ÚKOL Z POZNÁMKY V KALENDÁŘI (zadání 23. 9. 2026: „v kalendáři do poznámky
 * by mělo jít nějak vytvořit úkol stejně jako v chatu. Naváže se to na daného
 * zvukaře, který bude u té události. A pokud nebude, tak si na něj kalendář
 * počká, až se přiřadí zvukař, nebo když se změní, tak se ten úkol přiřadí
 * tomu, kdo tam aktuálně je.").
 *
 * Značka je stejná jako v chatu (`@úkol`), takže se nikdo nemusí učit nic
 * nového - viz lib/ukolyZChatu.ts. Příjemce se ale nevybírá zmínkou: úkol
 * z kalendáře patří ZVUKAŘI U TÉ UDÁLOSTI.
 *
 * Vazba událost → úkol se drží v KalendarUkol, aby se dalo:
 *  - počkat, dokud zvukař u události není (úkol zatím nikomu nevisí),
 *  - úkol přestěhovat, když se zvukař vymění,
 *  - úkol uklidit, když se `@úkol` z poznámky smaže nebo událost zmizí.
 *
 * Splněný úkol se NIKDY nemaže ani nestěhuje - je to hotová práce a nemá
 * se kvůli přepsané poznámce ztratit z historie.
 */

export type UdalostUkolu = {
  typ: 'SLOT' | 'BLOCK';
  id: string;
  /** Poznámka u události - z ní se úkol čte. */
  poznamka: string | null;
  zvukarUserId: string | null;
  zvukarName: string | null;
  /** Do názvu úkolu, ať je v to-do listu vidět, čeho se týká. */
  nazevUdalosti: string | null;
  zacatek: Date;
  /** Pásmo studia - termín úkolu má sedět na to, kdy se ve studiu točí. */
  pasmo: string;
  kdo: { id: string; jmeno: string } | null;
};

/**
 * ÚKOL SE UKÁŽE AŽ PATNÁCT MINUT PŘED UDÁLOSTÍ (zadání 12. 10. 2026: „Peter
 * zadá přes kalendář zvukaři úkol na zítra: podepiš s hercem smlouvu nebo
 * vytvoř si cut, ale cvakne mu to až v ten den 15 min. před tím časem").
 *
 * Úkol se založí hned - zadavatel ho má v „Zadal jsem" a ví, že je to
 * vyřízené - ale příjemci v seznamu NENÍ a zvonek mu necinká. Čas, od kdy se
 * ukáže, drží `Task.viditelnyOd`; „cvaknutí" (zvonek) obstará úloha
 * v `odemkniUkolyZKalendare` níž, která běží každých pět minut spolu
 * s připomínkami událostí.
 *
 * Stejných patnáct minut jako u připomínky před natáčením - viz
 * lib/pripominkyUdalostiServer.ts.
 */
export const PRED_UDALOSTI_MIN = 15;

/** Kde úkol v databázi hledat - podle druhu události. */
function kliceUdalosti(u: Pick<UdalostUkolu, 'typ' | 'id'>) {
  return u.typ === 'SLOT' ? { slotId: u.id } : { blockId: u.id };
}

/**
 * Srovná úkol podle aktuálního stavu události. Nikdy nevyhazuje - uložení
 * události na tom nesmí stát.
 */
export async function synchronizujUkolUdalosti(u: UdalostUkolu): Promise<void> {
  try {
    const kde = kliceUdalosti(u);
    const stavajici = await prisma.kalendarUkol.findFirst({ where: kde });

    const poznamka = u.poznamka ?? '';
    const text = jeUkol(poznamka) ? nazevUkolu(poznamka, u.zvukarName) : '';

    // Úkol z poznámky zmizel (nebo poznámku někdo přepsal) - uklidí se.
    if (!text) {
      if (stavajici) await zrusUkol(stavajici.id, stavajici.taskId);
      return;
    }

    const nazev = `${u.nazevUdalosti ? `${u.nazevUdalosti} — ` : ''}${text}`.slice(0, 300);
    const casti = utcParts(u.zacatek, u.pasmo);
    const dueDate = new Date(
      `${casti.year}-${String(casti.month).padStart(2, '0')}-${String(casti.day).padStart(2, '0')}T00:00:00.000Z`,
    );
    const dueTime = minutesToTime(minutesInZone(u.zacatek, u.pasmo));
    /** Od kdy úkol příjemce uvidí - patnáct minut před začátkem události. */
    const viditelnyOd = new Date(u.zacatek.getTime() - PRED_UDALOSTI_MIN * 60_000);
    const uzJeCas = viditelnyOd.getTime() <= Date.now();

    const zaznam =
      stavajici ??
      (await prisma.kalendarUkol.create({
        data: {
          ...kde,
          text,
          zadalId: u.kdo?.id ?? null,
          zadalJmeno: u.kdo?.jmeno ?? null,
        },
      }));

    if (stavajici && stavajici.text !== text) {
      await prisma.kalendarUkol.update({ where: { id: zaznam.id }, data: { text } });
    }

    // Zvukař u události ještě není - kalendář počká. Rozdělaný úkol, který
    // visel předchozímu zvukaři, se zatím sundá.
    if (!u.zvukarUserId) {
      if (zaznam.taskId) await smazNesplnenyUkol(zaznam.taskId);
      if (zaznam.taskId || zaznam.userId) {
        await prisma.kalendarUkol.update({ where: { id: zaznam.id }, data: { taskId: null, userId: null } });
      }
      return;
    }

    const ukol = zaznam.taskId ? await prisma.task.findUnique({ where: { id: zaznam.taskId } }) : null;

    // Splněný úkol se nechává být; další už se k téhle události nezakládá.
    if (ukol?.done) return;

    if (ukol) {
      const stehuje = ukol.userId !== u.zvukarUserId;
      await prisma.task.update({
        where: { id: ukol.id },
        data: { userId: u.zvukarUserId, title: nazev, dueDate, dueTime, viditelnyOd },
      });
      await prisma.kalendarUkol.update({
        where: { id: zaznam.id },
        data: { userId: u.zvukarUserId, ...(uzJeCas ? {} : { odemknutoAt: null }) },
      });
      /**
       * Zvonek jen tehdy, když už je úkol vidět. Přestěhovaný úkol, který se
       * teprve ukáže, zazvoní novému zvukaři sám v odemkniUkolyZKalendare -
       * jinak by mu cinkalo něco, co v seznamu ještě nemá.
       */
      if (stehuje && uzJeCas) {
        await zvonek(u.zvukarUserId, nazev, u.kdo?.jmeno ?? null);
        await prisma.kalendarUkol
          .update({ where: { id: zaznam.id }, data: { odemknutoAt: new Date() } })
          .catch(() => undefined);
      }
      return;
    }

    const posledni = await prisma.task.findFirst({
      where: { userId: u.zvukarUserId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const novy = await prisma.task.create({
      data: {
        userId: u.zvukarUserId,
        title: nazev,
        dueDate,
        dueTime,
        viditelnyOd,
        sortOrder: (posledni?.sortOrder ?? 0) + 10,
        zadalId: zaznam.zadalId ?? u.kdo?.id ?? null,
        zadalJmeno: zaznam.zadalJmeno ?? u.kdo?.jmeno ?? null,
      },
    });
    await prisma.kalendarUkol.update({
      where: { id: zaznam.id },
      data: {
        taskId: novy.id,
        userId: u.zvukarUserId,
        odemknutoAt: uzJeCas ? new Date() : null,
      },
    });
    // Úkol na zítřek zatím nikomu necinká - zazvoní patnáct minut předem.
    if (uzJeCas) await zvonek(u.zvukarUserId, nazev, zaznam.zadalJmeno ?? u.kdo?.jmeno ?? null);
  } catch (err) {
    console.error('Úkol z poznámky v kalendáři se nepodařilo srovnat:', err);
  }
}

/**
 * „CVAKNUTÍ" ÚKOLŮ, KTERÝM NASTAL ČAS (zadání 12. 10. 2026). Běží každých pět
 * minut spolu s připomínkami událostí - viz api/cron/pripominky-udalosti.
 *
 * Bere úkoly z kalendáře, které ještě nezazvonily a jejichž `viditelnyOd` už
 * je za námi: příjemci se tím objeví v seznamu (filtruje se podle téhož pole)
 * a zacinká mu zvonek. Splněný nebo mezitím smazaný úkol se přeskočí a jen se
 * orazítkuje, ať se na něj úloha neptá pořád dokola.
 */
export async function odemkniUkolyZKalendare(): Promise<{ odemceno: number }> {
  let odemceno = 0;
  try {
    const cekajici = await prisma.kalendarUkol.findMany({
      where: { odemknutoAt: null, taskId: { not: null } },
      take: 200,
    });
    if (cekajici.length === 0) return { odemceno: 0 };

    const ted = new Date();
    for (const z of cekajici) {
      const ukol = z.taskId
        ? await prisma.task.findUnique({ where: { id: z.taskId } }).catch(() => null)
        : null;

      // Úkol už neexistuje - razítko, ať se k němu úloha nevrací.
      if (!ukol) {
        await prisma.kalendarUkol
          .update({ where: { id: z.id }, data: { odemknutoAt: ted } })
          .catch(() => undefined);
        continue;
      }

      // Ještě nenastal čas - úloha se k němu vrátí za pět minut.
      if (ukol.viditelnyOd && ukol.viditelnyOd.getTime() > ted.getTime()) continue;

      await prisma.kalendarUkol
        .update({ where: { id: z.id }, data: { odemknutoAt: ted } })
        .catch(() => undefined);

      /**
       * ÚKOLY ZALOŽENÉ PŘED 12. 10. 2026 nemají `viditelnyOd` vyplněné -
       * zvonek jim zazvonil už tehdy, při zadání. Tady se jim jen dá razítko,
       * ať se jich úloha nedrží; zvonit podruhé by bylo matoucí.
       */
      if (!ukol.viditelnyOd) continue;
      if (ukol.done) continue;

      await zvonek(ukol.userId, ukol.title, z.zadalJmeno ?? null);
      odemceno += 1;
    }
  } catch (err) {
    console.error('Odemčení úkolů z kalendáře selhalo:', err);
  }
  return { odemceno };
}

/** Událost zmizela z kalendáře - úkol, který na ní visel, jde pryč s ní. */
export async function zrusUkolUdalosti(typ: 'SLOT' | 'BLOCK', id: string): Promise<void> {
  try {
    const zaznam = await prisma.kalendarUkol.findFirst({ where: kliceUdalosti({ typ, id }) });
    if (zaznam) await zrusUkol(zaznam.id, zaznam.taskId);
  } catch (err) {
    console.error('Úkol zrušené události se nepodařilo uklidit:', err);
  }
}

async function zrusUkol(zaznamId: string, taskId: string | null) {
  if (taskId) await smazNesplnenyUkol(taskId);
  await prisma.kalendarUkol.delete({ where: { id: zaznamId } }).catch(() => undefined);
}

/** Hotový úkol zůstává - je to odvedená práce, ne rozpracovaný záměr. */
async function smazNesplnenyUkol(taskId: string) {
  await prisma.task.deleteMany({ where: { id: taskId, done: false } }).catch(() => undefined);
}

async function zvonek(userId: string, nazev: string, zadal: string | null) {
  await notify({
    userId,
    kind: 'ukol-z-kalendare',
    title: zadal ? `Nový úkol od ${zadal}` : 'Nový úkol z kalendáře',
    body: nazev,
    url: '/kalendar',
  }).catch(() => undefined);
}
