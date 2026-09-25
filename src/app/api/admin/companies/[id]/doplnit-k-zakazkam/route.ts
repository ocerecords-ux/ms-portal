import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

/**
 * DOPLNĚNÍ HERCE A DOKLADŮ K ZAKÁZKÁM FIRMY (zadání 25. 9. 2026: „mám tady
 * projekty firmy Jan Minol, kde potřebuji u této firmy na tyto projekty
 * navázat klienta u všech projektů, a pak navázat nabídky a faktury. A herce.
 * Vše chci udělat v tichosti bez notifikací").
 *
 * Klienta ke všem zakázkám umí sousední /prirad-klienta. Tohle je na to
 * ostatní a po jedné zakázce: ke každé se vybere herec, nabídka a faktura.
 *
 * POTICHU, stejně jako u klienta: mění se jen ta pole. Žádný zápis do
 * historie projektu, žádný zvoneček, žádný e-mail herci ani klientovi -
 * je to doplnění evidence u starých zakázek, ne dnešní změna, o které by
 * se měl někdo dozvědět.
 *
 * Doklad se přiřadí jen tehdy, když patří téže firmě - jinak by se cizí
 * faktura přivázala k zakázce, se kterou nemá nic společného.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  radky: z
    .array(
      z.object({
        caflouProjectId: z.string().trim().min(1),
        /** '' = nechat, jak je. Herce se schválně nedá takhle odebrat. */
        actorUserId: z.string().trim().optional(),
        offerId: z.string().trim().optional(),
        invoiceId: z.string().trim().optional(),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const firma = await prisma.company.findUnique({ where: { id: params.id }, select: { name: true } });
  if (!firma) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });

  // Starší zakázky mívají u sebe jen název firmy - stejné pravidlo jako
  // u hromadného přiřazení klienta.
  const patriFirme = {
    OR: [
      { companyId: params.id },
      { companyId: null, companyName: { equals: firma.name, mode: 'insensitive' as const } },
    ],
  };

  try {
    const projekty = await prisma.projectMeta.findMany({
      where: patriFirme,
      select: { caflouProjectId: true, name: true },
    });
    const nazvy = new Map(projekty.map((p) => [p.caflouProjectId, p.name]));

    let herci = 0;
    let nabidky = 0;
    let faktury = 0;

    for (const radek of parsed.data.radky) {
      if (!nazvy.has(radek.caflouProjectId)) continue;
      const nazev = nazvy.get(radek.caflouProjectId) ?? null;

      if (radek.actorUserId) {
        const herec = await prisma.user.findFirst({
          where: { id: radek.actorUserId, role: 'HEREC' },
          select: { id: true },
        });
        if (herec) {
          await prisma.projectMeta.update({
            where: { caflouProjectId: radek.caflouProjectId },
            // Hlavní herec i vazba na seznam herců - projekt je ukazuje
            // z obojího a rozejít se nesmí.
            data: { actorUserId: herec.id, herci: { set: [{ id: herec.id }] } },
          });
          herci += 1;
        }
      }

      if (radek.offerId) {
        const { count } = await prisma.offer.updateMany({
          where: { id: radek.offerId, companyId: params.id },
          data: { caflouProjectId: radek.caflouProjectId, projectName: nazev },
        });
        nabidky += count;
      }

      if (radek.invoiceId) {
        const { count } = await prisma.invoice.updateMany({
          where: { id: radek.invoiceId, companyId: params.id },
          data: { caflouProjectId: radek.caflouProjectId, projectName: nazev },
        });
        faktury += count;
      }
    }

    return NextResponse.json({ ok: true, herci, nabidky, faktury });
  } catch (err) {
    console.error('Doplneni k zakazkam firmy selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}
