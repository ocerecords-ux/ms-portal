import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { uploadExpenseAttachment } from '@/lib/storage';

/**
 * PŘÍLOHY K UŽ ULOŽENÉMU VÝDAJI (zadání 21. 9. 2026: „potřeboval bych zpětně
 * upravovat výdaje a přidávat přílohy").
 *
 * POST (FormData, pole `soubor`, klidně víckrát): když doklad ještě hlavní
 * přílohu nemá, první soubor se stane hlavní (ukazuje se v náhledu a čte se
 * z ní), ostatní jdou mezi další přílohy.
 *
 * DELETE ?priloha=<id> odebere další přílohu, ?priloha=hlavni hlavní -
 * na její místo pak nastoupí nejstarší další příloha, ať náhled nezmizí.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  try {
    const expense = await prisma.expense.findUnique({ where: { id: params.id }, select: { attachmentUrl: true } });
    if (!expense) return NextResponse.json({ error: 'Doklad nenalezen.' }, { status: 404 });

    const formData = await req.formData();
    const soubory = formData.getAll('soubor').filter((f): f is File => f instanceof File && f.size > 0);
    if (soubory.length === 0) return NextResponse.json({ error: 'Chybí soubor.' }, { status: 400 });

    let maHlavni = Boolean(expense.attachmentUrl);
    for (const soubor of soubory) {
      const vysledek = await uploadExpenseAttachment(soubor);
      if (!vysledek) return NextResponse.json({ error: 'Soubor se nepodařilo uložit.' }, { status: 500 });
      if ('error' in vysledek) return NextResponse.json({ error: vysledek.error }, { status: 400 });

      if (!maHlavni) {
        await prisma.expense.update({
          where: { id: params.id },
          data: { attachmentUrl: vysledek.url, attachmentName: vysledek.name },
        });
        maHlavni = true;
      } else {
        await prisma.prilohaVydaje.create({
          data: { expenseId: params.id, url: vysledek.url, nazev: vysledek.name },
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/expenses/[id]/prilohy selhalo:', err);
    return NextResponse.json({ error: 'Přílohu se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const kterou = req.nextUrl.searchParams.get('priloha');
  if (!kterou) return NextResponse.json({ error: 'Chybí příloha.' }, { status: 400 });

  try {
    if (kterou === 'hlavni') {
      const nastupce = await prisma.prilohaVydaje.findFirst({
        where: { expenseId: params.id },
        orderBy: { createdAt: 'asc' },
      });
      await prisma.expense.update({
        where: { id: params.id },
        data: { attachmentUrl: nastupce?.url ?? null, attachmentName: nastupce?.nazev ?? null },
      });
      if (nastupce) await prisma.prilohaVydaje.delete({ where: { id: nastupce.id } });
    } else {
      await prisma.prilohaVydaje.deleteMany({ where: { id: kterou, expenseId: params.id } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/expenses/[id]/prilohy selhalo:', err);
    return NextResponse.json({ error: 'Přílohu se nepodařilo odebrat.' }, { status: 500 });
  }
}
