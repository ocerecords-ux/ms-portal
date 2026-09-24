import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * KONTAKTNÍ OSOBA KE VŠEM ZAKÁZKÁM FIRMY (zadání 24. 9. 2026: „potřebuju
 * u všech projektů, které se týkají Nakladatelství Jota, přiřadit klienta
 * Danu Nekvindovou, aby se jí propsaly do portálu dokončené projekty. Ale
 * potichu, bez notifikací").
 *
 * PROČ TO NEJDE PŘES KARTU PROJEKTU: uložení projektu zapisuje změnu do
 * historie a cinká zvonečkem; u firmy s desítkami hotových zakázek by to
 * znamenalo desítky upozornění na něco, co je jen doplnění evidence.
 * Tahle cesta proto mění JEN pole klienta - žádná historie, žádný zvonek,
 * žádný e-mail klientovi.
 *
 * Projekty tím klientovi zpřístupní jeho zakázky v portálu (v Projektech
 * i mezi dokončenými) - proto se to dělá po firmách a jen rukou Žůžo-labůžo.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  klientUserId: z.string().trim().min(1),
  /** true = přepsat i tam, kde už někdo přiřazený je. */
  prepsat: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Vyberte kontaktní osobu.' }, { status: 400 });

  // Klient musí patřit k té firmě - jinak by se cizí člověk dostal k zakázkám,
  // které nejsou jeho.
  const klient = await prisma.user.findFirst({
    where: { id: parsed.data.klientUserId, companyId: params.id, role: 'CLIENT' },
    select: { id: true, name: true, email: true },
  });
  if (!klient) {
    return NextResponse.json({ error: 'Tenhle účet k firmě nepatří.' }, { status: 400 });
  }

  try {
    const vysledek = await prisma.projectMeta.updateMany({
      where: {
        companyId: params.id,
        ...(parsed.data.prepsat ? {} : { klientUserId: null }),
      },
      data: {
        klientUserId: klient.id,
        // Jméno textem drží projekt čitelný i tam, kde se účty přeskupí.
        klientName: klient.name || klient.email,
      },
    });
    return NextResponse.json({ pocet: vysledek.count, jmeno: klient.name || klient.email });
  } catch (err) {
    console.error('Hromadne prirazeni klienta selhalo:', err);
    return NextResponse.json({ error: 'Přiřazení se nepodařilo.' }, { status: 500 });
  }
}
