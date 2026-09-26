import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * VZORY NATÁČECÍCH TEXTŮ (zadání 26. 9. 2026) - zakládání a úpravy.
 *
 * Jen admin, stejně jako u vzorů zpráv klientovi: je to text, který pak čte
 * herec ve studiu.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  id: z.string().trim().min(1).optional(),
  nazev: z.string().trim().min(1).max(120),
  uvod: z.string().max(4000).optional(),
  blok: z.string().min(1).max(4000),
  vychozi: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const telo = await req.json().catch(() => null);
  const data = schema.safeParse(telo);
  if (!data.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const { id, nazev, uvod, blok, vychozi, active } = data.data;

  try {
    const ulozeny = id
      ? await prisma.vzorNataceni.update({
          where: { id },
          data: { nazev, uvod: uvod?.trim() || null, blok, vychozi: vychozi ?? false, active: active ?? true },
        })
      : await prisma.vzorNataceni.create({
          data: { nazev, uvod: uvod?.trim() || null, blok, vychozi: vychozi ?? false, active: active ?? true },
        });

    // Výchozí smí být jen jeden - jinak by se nedalo poznat, který se nabídne.
    if (vychozi) {
      await prisma.vzorNataceni.updateMany({
        where: { id: { not: ulozeny.id } },
        data: { vychozi: false },
      });
    }

    return NextResponse.json({ id: ulozeny.id });
  } catch (err) {
    console.error('Uložení vzoru natáčecího textu selhalo:', err);
    return NextResponse.json({ error: 'Vzor se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Chybí vzor.' }, { status: 400 });

  try {
    // Vyřazení, ne smazání: dokumenty vyrobené z toho vzoru zůstávají a je
    // dobré vědět, podle čeho vznikly.
    await prisma.vzorNataceni.update({ where: { id }, data: { active: false, vychozi: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Vyřazení vzoru natáčecího textu selhalo:', err);
    return NextResponse.json({ error: 'Vzor se nepodařilo vyřadit.' }, { status: 500 });
  }
}
