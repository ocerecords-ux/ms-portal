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
        data: { userId: u.zvukarUserId, title: nazev, dueDate, dueTime },
      });
      await prisma.kalendarUkol.update({
        where: { id: zaznam.id },
        data: { userId: u.zvukarUserId },
      });
      if (stehuje) await zvonek(u.zvukarUserId, nazev, u.kdo?.jmeno ?? null);
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
        sortOrder: (posledni?.sortOrder ?? 0) + 10,
        zadalId: zaznam.zadalId ?? u.kdo?.id ?? null,
        zadalJmeno: zaznam.zadalJmeno ?? u.kdo?.jmeno ?? null,
      },
    });
    await prisma.kalendarUkol.update({
      where: { id: zaznam.id },
      data: { taskId: novy.id, userId: u.zvukarUserId },
    });
    await zvonek(u.zvukarUserId, nazev, zaznam.zadalJmeno ?? u.kdo?.jmeno ?? null);
  } catch (err) {
    console.error('Úkol z poznámky v kalendáři se nepodařilo srovnat:', err);
  }
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
