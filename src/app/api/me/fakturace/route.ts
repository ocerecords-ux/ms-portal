import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Fakturační nastavení firmy z pohledu klienta (zadání 13. 9. 2026: „bylo by
 * super, kdyby tohle mohl vidět a nastavit si i klient ve svém profilu").
 *
 * Kam chodí faktury, ví nejlíp odběratel sám - u větších firem se účtárna
 * i lidé u projektů mění častěji, než stihneme přepisovat. Klient si to tedy
 * srovná sám v „Můj účet".
 *
 * CO SE TÍM DÁ ZMĚNIT: výhradně e-mail pro faktury a to, jestli jde kopie
 * i člověku od projektu - a VÝHRADNĚ u firmy, pod kterou je přihlášený.
 * Firma se bere ze session, nikdy z těla požadavku.
 */
const schema = z.object({
  contactEmail: z.string().trim().toLowerCase().email('Zadejte platný e-mail.').or(z.literal('')),
  fakturyKlientovi: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });

    const companyId = session.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Váš účet nepatří pod žádnou firmu.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        contactEmail: parsed.data.contactEmail || null,
        fakturyKlientovi: parsed.data.fakturyKlientovi,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/me/fakturace selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nezdařilo.' }, { status: 500 });
  }
}
