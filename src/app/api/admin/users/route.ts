import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

const ROLE_VALUES = ['CLIENT', 'HEREC', 'DODAVATEL', 'ADMIN', 'ZVUKAR', 'PRODUKCE'] as const;
// Tyto role jsou vazane na klientskou firmu - viz src/lib/roles.ts (COMPANY_ROLES).
const COMPANY_REQUIRED_ROLES: string[] = ['CLIENT', 'HEREC', 'DODAVATEL'];

const schema = z
  .object({
    email: z.string().trim().toLowerCase().email('Zadejte platný e-mail.'),
    name: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    password: z.string().min(8, 'Heslo musí mít alespoň 8 znaků.'),
    companyId: z.string().trim().min(1).nullable().optional(),
    role: z.enum(ROLE_VALUES).default('CLIENT'),
    caflouTag: z.string().trim().optional(),
  })
  .refine((data) => !COMPANY_REQUIRED_ROLES.includes(data.role) || !!data.companyId, {
    message: 'Pro tuto roli musíte vybrat firmu.',
    path: ['companyId'],
  });

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: 'Uživatel s tímto e-mailem už existuje.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name || null,
      phone: parsed.data.phone || null,
      passwordHash,
      role: parsed.data.role,
      companyId: parsed.data.companyId || null,
      caflouTag: parsed.data.caflouTag || null,
    },
    select: { id: true, email: true, name: true, phone: true, role: true, companyId: true, caflouTag: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
