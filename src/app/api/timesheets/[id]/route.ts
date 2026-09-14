import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { polozkyVykazu, schemaVykazu } from '@/lib/timesheetyVstup';

// Smazani vykazu. Zvukar smi mazat jen svoje, admin cokoliv.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });

    const entry = await prisma.timesheetEntry.findUnique({ where: { id: params.id } });
    if (!entry) return NextResponse.json({ error: 'Výkaz nenalezen.' }, { status: 404 });

    const isOwner = entry.userId === session.user.id;
    if (!isOwner && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Můžete mazat jen svoje výkazy.' }, { status: 403 });
    }

    await prisma.timesheetEntry.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/timesheets/[id] selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}

/**
 * Uprava vykazu (zadani 14. 9. 2026: "A melo by jit upravit vykazy. Prava na
 * to budou mit Zuzo-labuzo i zvukari").
 *
 * Prava jsou stejna jako u mazani, ktere tu je od zacatku: zvukar svoje,
 * Zuzo-labuzo cokoliv. Bylo by divne moct cizi vykaz smazat, ale neopravit.
 *
 * CO SE NEMENI:
 * - komu vykaz patri. userId se z tela pozadavku vubec necte, takze ani
 *   Zuzo-labuzo nemuze vykaz "prehodit" na jineho zvukare.
 * - hodinova sazba. hourlyRateSnapshot je sazba PLATNA V DOBE ZAPISU - je to
 *   zaznam o tom, za kolik se prace tehdy vykazala. Kdyby se pri kazde
 *   uprave prepsala na dnesni, zmenily by se zpetne castky v uzavrenych
 *   mesicich.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });

    const entry = await prisma.timesheetEntry.findUnique({ where: { id: params.id } });
    if (!entry) return NextResponse.json({ error: 'Výkaz nenalezen.' }, { status: 404 });

    const isOwner = entry.userId === session.user.id;
    if (!isOwner && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Můžete upravovat jen svoje výkazy.' }, { status: 403 });
    }

    const parsed = schemaVykazu.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const pripraveno = polozkyVykazu(parsed.data);
    if (!pripraveno.ok) {
      return NextResponse.json({ error: pripraveno.chyba }, { status: 400 });
    }

    const upraveny = await prisma.timesheetEntry.update({
      where: { id: params.id },
      data: pripraveno.data,
    });

    return NextResponse.json(upraveny);
  } catch (err) {
    console.error('PATCH /api/timesheets/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
