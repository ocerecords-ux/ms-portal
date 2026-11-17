import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { jeUzavreny, pristupKPozadavkum, smiDoStudia } from '@/lib/pozadavkyStudii';

/**
 * Úprava a smazání jednoho požadavku (17. 11. 2026).
 *
 * KDO CO SMÍ:
 *   správce (`vidiPozadavkyStudii`) - všechno, včetně přehazování stavů,
 *   vedoucí pobočky - jen SVŮJ požadavek a jen dokud je NOVÝ.
 *
 * Jakmile se někdo věci chytil, přestává to být zápis vedoucího a je to
 * společná položka - proto se vedoucímu zamkne.
 */
const schema = z.object({
  text: z.string().trim().min(1).max(300).optional(),
  popis: z.string().trim().max(2000).nullable().optional(),
  druh: z.enum(['KOUPIT', 'UDELAT']).optional(),
  specha: z.boolean().optional(),
  stav: z.enum(['NOVY', 'ZARIZUJE_SE', 'HOTOVO', 'ZAMITNUTO']).optional(),
  vyrizeniPoznamka: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    }

    const pozadavek = await prisma.pozadavekStudia.findUnique({
      where: { id: params.id },
      select: { id: true, studioId: true, zadalId: true, stav: true },
    });
    if (!pozadavek) {
      return NextResponse.json({ error: 'Požadavek neexistuje.' }, { status: 404 });
    }

    const pristup = await pristupKPozadavkum(session.user.id, session.user.role);
    if (!smiDoStudia(pristup, pozadavek.studioId)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    if (!pristup.spravce) {
      const mujANovy = pozadavek.zadalId === session.user.id && pozadavek.stav === 'NOVY';
      if (!mujANovy) {
        return NextResponse.json(
          { error: 'Tenhle požadavek už upravit nejde.' },
          { status: 403 },
        );
      }
      // Stav prehazuje jen spravce - vedouci opravuje jen to, co napsal.
      if (parsed.data.stav !== undefined || parsed.data.vyrizeniPoznamka !== undefined) {
        return NextResponse.json({ error: 'Stav mění jen správce seznamu.' }, { status: 403 });
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.text !== undefined) data.text = parsed.data.text;
    if (parsed.data.popis !== undefined) data.popis = parsed.data.popis || null;
    if (parsed.data.druh !== undefined) data.druh = parsed.data.druh;
    if (parsed.data.specha !== undefined) data.specha = parsed.data.specha;
    if (parsed.data.vyrizeniPoznamka !== undefined) {
      data.vyrizeniPoznamka = parsed.data.vyrizeniPoznamka || null;
    }
    if (parsed.data.stav !== undefined) {
      data.stav = parsed.data.stav;
      // Kdo to uzavrel a kdy - a pri vraceni zpet se to zase smaze, at
      // v seznamu nestoji "vyridil Peter" u polozky, ktera zase bezi.
      if (jeUzavreny(parsed.data.stav)) {
        data.vyrizenoAt = new Date();
        data.vyridilId = session.user.id;
      } else {
        data.vyrizenoAt = null;
        data.vyridilId = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    }

    await prisma.pozadavekStudia.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/pozadavky/[id] selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !isInternalRole(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const pozadavek = await prisma.pozadavekStudia.findUnique({
      where: { id: params.id },
      select: { studioId: true, zadalId: true, stav: true },
    });
    if (!pozadavek) return NextResponse.json({ ok: true });

    const pristup = await pristupKPozadavkum(session.user.id, session.user.role);
    if (!smiDoStudia(pristup, pozadavek.studioId)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }
    if (!pristup.spravce) {
      const mujANovy = pozadavek.zadalId === session.user.id && pozadavek.stav === 'NOVY';
      if (!mujANovy) {
        return NextResponse.json({ error: 'Tenhle požadavek smazat nejde.' }, { status: 403 });
      }
    }

    await prisma.pozadavekStudia.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/pozadavky/[id] selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}
