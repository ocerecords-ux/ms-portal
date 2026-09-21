import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { userLabel } from '@/lib/chatServer';
import { CAS_UKOLU, popisTerminu } from '@/lib/terminUkolu';

/**
 * Změna a smazání úkolu (zadání 5. 9. 2026).
 *
 * KDO SMÍ CO:
 *  - PŘÍJEMCE (úkol je jeho, userId) smí všechno: odškrtnout, přejmenovat,
 *    změnit termín, smazat.
 *  - ZADAVATEL (zadal ho někomu jinému z chatu, zadalId) smí od 21. 9. 2026
 *    úkol UPRAVIT - název, datum a čas - a ZRUŠIT („a když někomu zadám
 *    úkol, chci ho editovat"). Odškrtnout ho nesmí: splnit ho má ten, komu
 *    patří.
 *  - Nikdo jiný na cizí úkol nesáhne.
 *
 * O každé změně od toho druhého se dozví ten první - pod zvonkem.
 */
const patchSchema = z.object({
  done: z.boolean().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  /** YYYY-MM-DD nebo null = bez termínu. */
  dueDate: z.string().trim().min(8).max(10).nullable().optional(),
  /** „HH:MM" nebo null = do konce dne (21. 9. 2026). */
  dueTime: z.string().trim().regex(CAS_UKOLU, 'Neplatný čas.').nullable().optional(),
});

type UkolProOznameni = {
  title: string;
  userId: string;
  zadalId: string | null;
  zdrojKonverzaceId: string | null;
};

async function jmenoUctu(id: string): Promise<string> {
  const kdo = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return kdo ? userLabel(kdo) : 'Kolega';
}

/**
 * Zadavatel se dozví, co se s jeho úkolem stalo (zadání 21. 9. 2026: „potřebuji
 * vidět, že jsem ho vytvořil a že ho pak ten člověk splnil"). Jen u úkolu,
 * který zadal někdo JINÝ - vlastní odškrtnutí nikomu nic neoznamuje.
 */
async function oznamZadavateli(ukol: UkolProOznameni, kdoId: string, co: 'splnil' | 'smazal') {
  if (!ukol.zadalId || ukol.zadalId === kdoId) return;
  const jmeno = await jmenoUctu(kdoId);
  await notify({
    userId: ukol.zadalId,
    kind: co === 'splnil' ? 'ukol-splnen' : 'ukol-smazan',
    title: co === 'splnil' ? `${jmeno} splnil(a) úkol` : `${jmeno} smazal(a) úkol, který jste zadali`,
    body: ukol.title,
    url: ukol.zdrojKonverzaceId ? `/chat?konverzace=${ukol.zdrojKonverzaceId}` : null,
  });
}

/** Příjemce se dozví, že mu zadavatel úkol upravil nebo zrušil. */
async function oznamPrijemci(ukol: UkolProOznameni, kdoId: string, co: 'upravil' | 'zrusil', popis: string) {
  if (ukol.userId === kdoId) return;
  const jmeno = await jmenoUctu(kdoId);
  await notify({
    userId: ukol.userId,
    kind: co === 'upravil' ? 'ukol-upraven' : 'ukol-zrusen',
    title: co === 'upravil' ? `${jmeno} upravil(a) váš úkol` : `${jmeno} zrušil(a) úkol`,
    body: popis,
    url: ukol.zdrojKonverzaceId ? `/chat?konverzace=${ukol.zdrojKonverzaceId}` : null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }
    const ja = session.user.id;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const puvodni = await prisma.task.findFirst({
      where: { id: params.id, OR: [{ userId: ja }, { zadalId: ja }] },
      select: {
        done: true,
        title: true,
        userId: true,
        zadalId: true,
        zdrojKonverzaceId: true,
        dueDate: true,
        dueTime: true,
      },
    });
    if (!puvodni) {
      return NextResponse.json({ error: 'Úkol nenalezen.' }, { status: 404 });
    }
    const jePrijemce = puvodni.userId === ja;

    // Zadavatel smí upravit, ne odškrtnout.
    if (!jePrijemce && d.done !== undefined) {
      return NextResponse.json({ error: 'Splnit úkol může jen ten, komu patří.' }, { status: 403 });
    }

    let dueDate: Date | null | undefined = undefined;
    if (d.dueDate !== undefined) {
      dueDate = d.dueDate ? new Date(`${d.dueDate}T00:00:00.000Z`) : null;
      if (dueDate && Number.isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: 'Neplatný termín.' }, { status: 400 });
      }
    }
    const bezData = dueDate === null || (dueDate === undefined && !puvodni.dueDate);

    // Kdy byl splněný - to vidí zadavatel v „Zadal jsem" (21. 9. 2026).
    const zmenaStavu = d.done !== undefined && d.done !== puvodni.done;
    await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.done !== undefined ? { done: d.done } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        // Čas bez data nedává smysl.
        ...(bezData ? { dueTime: null } : d.dueTime !== undefined ? { dueTime: d.dueTime } : {}),
        ...(zmenaStavu ? { splnenoAt: d.done ? new Date() : null } : {}),
      },
    });

    if (zmenaStavu && d.done) await oznamZadavateli(puvodni, ja, 'splnil');

    // Zadavatel změnil úkol - příjemce musí vědět, co teď platí.
    if (!jePrijemce) {
      const nazev = d.title ?? puvodni.title;
      const datum = dueDate !== undefined ? d.dueDate ?? null : puvodni.dueDate?.toISOString().slice(0, 10) ?? null;
      const cas = bezData ? null : d.dueTime !== undefined ? d.dueTime : puvodni.dueTime;
      await oznamPrijemci(puvodni, ja, 'upravil', datum ? `${nazev} — do ${popisTerminu(datum, cas)}` : nazev);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/tasks/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }
    const ja = session.user.id;

    // Smazat smí příjemce i zadavatel (zadavatel tím úkol ruší).
    const ukol = await prisma.task.findFirst({
      where: { id: params.id, OR: [{ userId: ja }, { zadalId: ja }] },
      select: { done: true, title: true, userId: true, zadalId: true, zdrojKonverzaceId: true },
    });
    if (!ukol) {
      return NextResponse.json({ error: 'Úkol nenalezen.' }, { status: 404 });
    }
    await prisma.task.delete({ where: { id: params.id } });

    if (ukol.userId === ja) {
      // Nesplněný zadaný úkol zmizel - zadavatel by jinak čekal na něco, co už
      // neexistuje. Smazání hotového nikoho nezajímá.
      if (!ukol.done) await oznamZadavateli(ukol, ja, 'smazal');
    } else if (!ukol.done) {
      await oznamPrijemci(ukol, ja, 'zrusil', ukol.title);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tasks/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
