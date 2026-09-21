import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { userLabel } from '@/lib/chatServer';

/**
 * Zadavatel se dozví, co se s jeho úkolem stalo (zadání 21. 9. 2026: „potřebuji
 * vidět, že jsem ho vytvořil a že ho pak ten člověk splnil"). Jen u úkolu,
 * který zadal někdo JINÝ - vlastní odškrtnutí nikomu nic neoznamuje.
 */
async function oznamZadavateli(
  ukol: { title: string; zadalId: string | null; zdrojKonverzaceId: string | null },
  kdoId: string,
  co: 'splnil' | 'smazal',
) {
  if (!ukol.zadalId || ukol.zadalId === kdoId) return;
  const kdo = await prisma.user.findUnique({ where: { id: kdoId }, select: { name: true, email: true } });
  const jmeno = kdo ? userLabel(kdo) : 'Kolega';
  await notify({
    userId: ukol.zadalId,
    kind: co === 'splnil' ? 'ukol-splnen' : 'ukol-smazan',
    title: co === 'splnil' ? `${jmeno} splnil(a) úkol` : `${jmeno} smazal(a) úkol, který jste zadali`,
    body: ukol.title,
    url: ukol.zdrojKonverzaceId ? `/chat?konverzace=${ukol.zdrojKonverzaceId}` : null,
  });
}

// Zmena a smazani ukolu (zadani 5. 9. 2026). Ukol se vzdy hleda spolu s
// userId ze session - cizi ukol proto nejde ani odskrtnout, ani smazat.
const patchSchema = z.object({
  done: z.boolean().optional(),
  title: z.string().trim().min(1).max(300).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const puvodni = await prisma.task.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { done: true, title: true, zadalId: true, zdrojKonverzaceId: true },
    });
    if (!puvodni) {
      return NextResponse.json({ error: 'Úkol nenalezen.' }, { status: 404 });
    }

    // Kdy byl splněný - to vidí zadavatel v „Zadal jsem" (21. 9. 2026).
    const zmenaStavu = parsed.data.done !== undefined && parsed.data.done !== puvodni.done;
    await prisma.task.updateMany({
      where: { id: params.id, userId: session.user.id },
      data: {
        ...parsed.data,
        ...(zmenaStavu ? { splnenoAt: parsed.data.done ? new Date() : null } : {}),
      },
    });

    if (zmenaStavu && parsed.data.done) {
      await oznamZadavateli(puvodni, session.user.id, 'splnil');
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

    const ukol = await prisma.task.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { done: true, title: true, zadalId: true, zdrojKonverzaceId: true },
    });
    const result = await prisma.task.deleteMany({ where: { id: params.id, userId: session.user.id } });
    if (result.count === 0 || !ukol) {
      return NextResponse.json({ error: 'Úkol nenalezen.' }, { status: 404 });
    }
    // Nesplněný zadaný úkol zmizel - zadavatel by jinak čekal na něco, co už
    // neexistuje. Smazání hotového nikoho nezajímá.
    if (!ukol.done) await oznamZadavateli(ukol, session.user.id, 'smazal');

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tasks/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Smazání se nezdařilo (${message}).` }, { status: 500 });
  }
}
