import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nextCode, codePrefixForRole } from '@/lib/codes';

/**
 * ÚČET TABULE PRO STUDIO (zadání 22. 9. 2026: „vytvořil bych pro každé studio
 * účet, kterým se přihlásím v Chromu na počítači u monitoru").
 *
 * POST { email, heslo } - založí účet s rolí TABULE, nebo existujícímu účtu
 * tabule tohoto studia nastaví nové heslo. Účet po přihlášení vidí jen
 * tabuli svého studia (viz /tabule/moje) - do portálu ani do dat nesmí.
 */
const schema = z.object({
  email: z.string().trim().toLowerCase().email('Zadejte platný e-mail (nemusí to být skutečná schránka).'),
  heslo: z.string().min(8, 'Heslo musí mít alespoň 8 znaků.'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { email, heslo } = parsed.data;

  const studio = await prisma.studio.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!studio) return NextResponse.json({ error: 'Studio nenalezeno.' }, { status: 404 });

  const passwordHash = await bcrypt.hash(heslo, 10);
  const existujici = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, tabuleStudioId: true } });

  if (existujici) {
    // Cizí účet (člověka) se na tabuli nepřepíše - to by mu vzalo přístup do portálu.
    if (existujici.role !== 'TABULE') {
      return NextResponse.json({ error: 'Tenhle e-mail už má jiný účet. Zvolte jiný, třeba tabule-brno1@mediaspace.cz.' }, { status: 409 });
    }
    await prisma.user.update({
      where: { id: existujici.id },
      data: { passwordHash, tabuleStudioId: studio.id, active: true },
    });
    return NextResponse.json({ ok: true, id: existujici.id, novy: false });
  }

  const code = await nextCode(codePrefixForRole('TABULE'));
  const ucet = await prisma.user.create({
    data: {
      code,
      email,
      name: `Tabule ${studio.name}`,
      passwordHash,
      role: 'TABULE',
      tabuleStudioId: studio.id,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: ucet.id, novy: true });
}

/** Zrušení účtu tabule - vypne se (přihlášení přestane fungovat). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const userId = req.nextUrl.searchParams.get('ucet') ?? '';
  const ucet = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, tabuleStudioId: true } });
  if (!ucet || ucet.role !== 'TABULE' || ucet.tabuleStudioId !== params.id) {
    return NextResponse.json({ error: 'Účet tabule nenalezen.' }, { status: 404 });
  }
  await prisma.user.update({ where: { id: ucet.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
