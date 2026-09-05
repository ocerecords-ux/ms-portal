import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';

// Uprava vlastnich udaju prihlaseneho uzivatele (zadani 5. 9. 2026).
//
// KLICOVE: menit jde VYHRADNE jmeno, e-mail a telefon (a u internich uctu
// Mediaspace navic datum narozeni). Role, ID uctu ani prirazeni k firme se
// tudy zmenit NEDA - to zustava jen v administraci. Uzivatele bereme vzdy ze
// session, nikdy z tela pozadavku.
const schema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email('Zadejte platný e-mail.').optional(),
  phone: z.string().trim().max(50).optional(),
  birthDate: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });
    }
    const userId = session.user.id;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Účet nenalezen.' }, { status: 404 });

    if (data.email && data.email !== user.email) {
      const taken = await prisma.user.findUnique({ where: { email: data.email } });
      if (taken) {
        return NextResponse.json({ error: 'Tento e-mail už používá jiný účet.' }, { status: 409 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name || null } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        // Datum narozeni vedeme jen u interniho tymu Mediaspace.
        ...(isInternalRole(user.role) && data.birthDate !== undefined
          ? { birthDate: data.birthDate ? new Date(data.birthDate) : null }
          : {}),
      },
      select: { id: true, name: true, email: true, phone: true, birthDate: true },
    });

    return NextResponse.json({
      ...updated,
      emailChanged: Boolean(data.email && data.email !== user.email),
    });
  } catch (err) {
    console.error('PATCH /api/me selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
