import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { kdoJe } from '@/lib/kdoJe';

/**
 * ÚČET KLIENTA STUDIA (zadání 25. 9. 2026: „pod kliknutím na jméno by měl jít
 * nastavit osobní profil a různé notifikace, změny termínů a pod").
 *
 * Mění se VÝHRADNĚ jméno, telefon a tři přepínače upozornění. E-mail ne:
 * je to přihlašovací jméno a zároveň adresa, na kterou chodí pozvánka -
 * změnu řeší tým na kartě uživatele. Role ani studio tudy nejdou vůbec.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  jmeno: z.string().trim().max(200).optional(),
  telefon: z.string().trim().max(50).optional(),
  potvrzeni: z.boolean().optional(),
  zmena: z.boolean().optional(),
  pripominka: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  await prisma.user.update({
    where: { id: ja.id },
    data: {
      ...(d.jmeno === undefined ? {} : { name: d.jmeno || null }),
      ...(d.telefon === undefined ? {} : { phone: d.telefon || null }),
      ...(d.potvrzeni === undefined ? {} : { bookingMailPotvrzeni: d.potvrzeni }),
      ...(d.zmena === undefined ? {} : { bookingMailZmena: d.zmena }),
      ...(d.pripominka === undefined ? {} : { bookingMailPripominka: d.pripominka }),
    },
  });

  return NextResponse.json({ ok: true });
}
