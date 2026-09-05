import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

const ROLE_VALUES = ['CLIENT', 'HEREC', 'DODAVATEL', 'ADMIN', 'ZVUKAR', 'PRODUKCE'] as const;
const COMPANY_REQUIRED_ROLES: string[] = ['CLIENT', 'HEREC', 'DODAVATEL'];

// Umoznuje upravit vsechny udaje uzivatele (e-mail, jmeno, telefon, roli,
// prirazenou firmu, aktivni stav, stitek v Caflou i heslo) - viz
// schema.prisma > model User. Vsechna pole jsou nepovinna, posila se jen to,
// co se ve formulari skutecne meni.
const schema = z.object({
  email: z.string().trim().toLowerCase().email('Zadejte platný e-mail.').optional(),
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(8, 'Heslo musí mít alespoň 8 znaků.').optional(),
  companyId: z.string().trim().min(1).nullable().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  caflouTag: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existingUser) {
    return NextResponse.json({ error: 'Uživatel nenalezen.' }, { status: 404 });
  }

  // Vysledna role/firma po aplikaci zmen - kontrolujeme kombinaci obou, ne
  // jen to pole, ktere se prave meni (napr. zmena role bez zmeny firmy).
  const nextRole = parsed.data.role ?? existingUser.role;
  const nextCompanyId = parsed.data.companyId !== undefined ? parsed.data.companyId : existingUser.companyId;
  if (COMPANY_REQUIRED_ROLES.includes(nextRole) && !nextCompanyId) {
    return NextResponse.json({ error: 'Pro tuto roli musíte vybrat firmu.' }, { status: 400 });
  }

  if (parsed.data.email && parsed.data.email !== existingUser.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) {
      return NextResponse.json({ error: 'Uživatel s tímto e-mailem už existuje.' }, { status: 409 });
    }
  }

  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : undefined;

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name || null } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
      ...(parsed.data.companyId !== undefined ? { companyId: parsed.data.companyId || null } : {}),
      ...(parsed.data.caflouTag !== undefined ? { caflouTag: parsed.data.caflouTag || null } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      companyId: true,
      caflouTag: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}
