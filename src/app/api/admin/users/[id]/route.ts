import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { uploadUserPhoto } from '@/lib/storage';

const ROLE_VALUES = ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'] as const;
const COMPANY_REQUIRED_ROLES: string[] = ['CLIENT'];
const INTERNAL_ROLES: string[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

// Umoznuje upravit vsechny udaje uzivatele - viz schema.prisma > model User.
// multipart/form-data kvuli volitelne fotce u Mediaspace uctu (viz
// /api/admin/users POST pro stejny vzor).
const schema = z.object({
  email: z.string().trim().toLowerCase().email('Zadejte platný e-mail.').optional(),
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(8, 'Heslo musí mít alespoň 8 znaků.').optional(),
  companyId: z.string().trim().min(1).nullable().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  caflouTag: z.string().trim().optional(),
  active: z.boolean().optional(),
  removePhoto: z.boolean().optional(),
  birthDate: z.string().trim().optional(),
  studioLocations: z.array(z.string()).optional(),
  birthNumber: z.string().trim().optional(),
  ic: z.string().trim().optional(),
  dic: z.string().trim().optional(),
  vatPayer: z.boolean().optional(),
  bankAccount: z.string().trim().optional(),
  addressStreet: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressZip: z.string().trim().optional(),
  addressCountry: z.string().trim().optional(),
});

function readFormData(formData: FormData) {
  const has = (key: string) => formData.has(key);
  return {
    email: has('email') ? formData.get('email') : undefined,
    name: has('name') ? formData.get('name') : undefined,
    phone: has('phone') ? formData.get('phone') : undefined,
    password: formData.get('password') || undefined,
    companyId: has('companyId') ? formData.get('companyId') || null : undefined,
    role: has('role') ? formData.get('role') : undefined,
    caflouTag: has('caflouTag') ? formData.get('caflouTag') : undefined,
    active: has('active') ? formData.get('active') === 'true' : undefined,
    removePhoto: formData.get('removePhoto') === 'true',
    birthDate: has('birthDate') ? formData.get('birthDate') : undefined,
    studioLocations: has('studioLocations') ? formData.getAll('studioLocations').map(String) : undefined,
    birthNumber: has('birthNumber') ? formData.get('birthNumber') : undefined,
    ic: has('ic') ? formData.get('ic') : undefined,
    dic: has('dic') ? formData.get('dic') : undefined,
    vatPayer: has('vatPayer') ? formData.get('vatPayer') === 'true' : undefined,
    bankAccount: has('bankAccount') ? formData.get('bankAccount') : undefined,
    addressStreet: has('addressStreet') ? formData.get('addressStreet') : undefined,
    addressCity: has('addressCity') ? formData.get('addressCity') : undefined,
    addressZip: has('addressZip') ? formData.get('addressZip') : undefined,
    addressCountry: has('addressCountry') ? formData.get('addressCountry') : undefined,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const formData = await req.formData();
  const parsed = schema.safeParse(readFormData(formData));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const data = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existingUser) {
    return NextResponse.json({ error: 'Uživatel nenalezen.' }, { status: 404 });
  }

  const nextRole = data.role ?? existingUser.role;
  const nextCompanyId = data.companyId !== undefined ? data.companyId : existingUser.companyId;
  if (COMPANY_REQUIRED_ROLES.includes(nextRole) && !nextCompanyId) {
    return NextResponse.json({ error: 'Pro tuto roli musíte vybrat firmu.' }, { status: 400 });
  }

  if (data.email && data.email !== existingUser.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailTaken) {
      return NextResponse.json({ error: 'Uživatel s tímto e-mailem už existuje.' }, { status: 409 });
    }
  }

  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;

  let photoUrl: string | null | undefined = undefined;
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    photoUrl = await uploadUserPhoto(photo);
  } else if (data.removePhoto) {
    photoUrl = null;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.name !== undefined ? { name: data.name || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.companyId !== undefined
        ? { companyId: COMPANY_REQUIRED_ROLES.includes(nextRole) ? data.companyId || null : null }
        : {}),
      // Stitek v Caflou je od 8. 9. 2026 jen a pouze u Klientu (zadani) - u
      // jine (nebo nove zvolene) role se natvrdo vynuluje, i kdyby formular
      // nejakou starou hodnotu poslal.
      ...(nextRole === 'CLIENT'
        ? data.caflouTag !== undefined
          ? { caflouTag: data.caflouTag || null }
          : {}
        : { caflouTag: null }),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      ...(INTERNAL_ROLES.includes(nextRole) && data.birthDate !== undefined
        ? { birthDate: data.birthDate ? new Date(data.birthDate) : null }
        : {}),
      ...(photoUrl !== undefined ? { photoUrl } : {}),
      ...(nextRole === 'HEREC'
        ? {
            ...(data.studioLocations !== undefined ? { studioLocations: data.studioLocations } : {}),
            ...(data.birthNumber !== undefined ? { birthNumber: data.birthNumber || null } : {}),
            ...(data.ic !== undefined ? { ic: data.ic || null } : {}),
            ...(data.dic !== undefined ? { dic: data.dic || null } : {}),
            ...(data.vatPayer !== undefined ? { vatPayer: data.vatPayer } : {}),
            ...(data.bankAccount !== undefined ? { bankAccount: data.bankAccount || null } : {}),
            ...(data.addressStreet !== undefined ? { addressStreet: data.addressStreet || null } : {}),
            ...(data.addressCity !== undefined ? { addressCity: data.addressCity || null } : {}),
            ...(data.addressZip !== undefined ? { addressZip: data.addressZip || null } : {}),
            ...(data.addressCountry !== undefined ? { addressCountry: data.addressCountry || null } : {}),
          }
        : {}),
    },
    select: {
      id: true,
      code: true,
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
