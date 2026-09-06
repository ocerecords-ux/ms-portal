import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nextCode, codePrefixForRole } from '@/lib/codes';
import { uploadUserPhoto } from '@/lib/storage';

const ROLE_VALUES = ['CLIENT', 'HEREC', 'ADMIN', 'ZVUKAR', 'PRODUKCE'] as const;
// Tyto role jsou vazane na klientskou firmu - viz src/lib/roles.ts (COMPANY_ROLES).
// Herec od 5. 9. 2026 uz firmu nema (samostatna jednotka).
const COMPANY_REQUIRED_ROLES: string[] = ['CLIENT'];
const INTERNAL_ROLES: string[] = ['ADMIN', 'ZVUKAR', 'PRODUKCE'];

// multipart/form-data misto JSON - Mediaspace ucty maji volitelnou fotku
// (soubor), takze telo pozadavku uz nemuze byt cisty JSON (viz take
// /api/orders pro stejny vzor s prilohou objednavky).
const schema = z
  .object({
    email: z.string().trim().toLowerCase().email('Zadejte platný e-mail.'),
    name: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    password: z.string().min(8, 'Heslo musí mít alespoň 8 znaků.'),
    companyId: z.string().trim().min(1).nullable().optional(),
    role: z.enum(ROLE_VALUES).default('CLIENT'),
    caflouTag: z.string().trim().optional(),
    // Mediaspace
    birthDate: z.string().trim().optional(),
  // Hodinova sazba zvukare (zadani 6. 9. 2026) - pocita se z ni vykaz prace.
  hourlyRate: z.string().trim().optional(),
    // Herec
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
  })
  .refine((data) => !COMPANY_REQUIRED_ROLES.includes(data.role) || !!data.companyId, {
    message: 'Pro tuto roli musíte vybrat firmu.',
    path: ['companyId'],
  });

// Oprava 12. 9. 2026: formData.get(klic) vraci pro nepritomny klic null, ne
// undefined - ale zod .optional() (bez .nullable()) povoluje jen undefined.
// NewUserForm posila caflouTag/Herec-pole (birthNumber, ic, dic, bankAccount,
// adresa...) jen podminene (podle role - viz isClient/isHerec tamtez), takze
// pro ostatni role tyhle klice ve FormData vubec nejsou. Bez has() kontroly
// tak zod padal na "Expected string, received null" a zalozeni uctu selhalo
// uplne (napr. u Mediaspace uctu, ktery caflouTag ani Herec-pole neposila
// vubec). Stejny vzor uz spravne pouziva PATCH /api/admin/users/[id].
function readFormData(formData: FormData) {
  const has = (key: string) => formData.has(key);
  return {
    email: formData.get('email'),
    name: has('name') ? formData.get('name') : undefined,
    phone: has('phone') ? formData.get('phone') : undefined,
    password: formData.get('password'),
    companyId: formData.get('companyId') || null,
    role: formData.get('role'),
    caflouTag: has('caflouTag') ? formData.get('caflouTag') : undefined,
    birthDate: has('birthDate') ? formData.get('birthDate') : undefined,
    hourlyRate: has('hourlyRate') ? formData.get('hourlyRate') : undefined,
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

// Oprava 12. 9. 2026: cela routa byla drive bez try/catch - jakakoli
// nezachycena vyjimka (napr. drivejsi pad pri nahravani fotky, viz
// lib/storage.ts) skoncila jako holy 500 bez JSON tela, takze frontend
// (NewUserForm) mohl ukazat jen obecnou hlasku "Účet se nepodařilo založit."
// bez jakekoli stopy, co se skutecne pokazilo. Ted se kazda neocekavana
// chyba zaloguje na server (dohledatelne v logu deploymentu) a klientovi se
// vrati aspon strucny popis mista chyby.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const formData = await req.formData();
    const parsed = schema.safeParse(readFormData(formData));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: 'Uživatel s tímto e-mailem už existuje.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    let photoUrl: string | null = null;
    const photo = formData.get('photo');
    if (INTERNAL_ROLES.includes(data.role) && photo instanceof File && photo.size > 0) {
      photoUrl = await uploadUserPhoto(photo);
    }

    const code = await nextCode(codePrefixForRole(data.role));

    const user = await prisma.user.create({
      data: {
        code,
        email: data.email,
        name: data.name || null,
        phone: data.phone || null,
        passwordHash,
        role: data.role,
        companyId: COMPANY_REQUIRED_ROLES.includes(data.role) ? data.companyId || null : null,
        // Stitek v Caflou je od 8. 9. 2026 jen a pouze u Klientu (zadani) - u
        // ostatnich roli se neuklada, i kdyby ho formular nejak poslal.
        caflouTag: data.role === 'CLIENT' ? data.caflouTag || null : null,
        ...(INTERNAL_ROLES.includes(data.role)
          ? {
              birthDate: data.birthDate ? new Date(data.birthDate) : null,
              photoUrl,
            }
          : {}),
        // Hodinova sazba dava smysl jen u zvukare (zadani 6. 9. 2026);
        // kdyz se nevyplni, zustava vychozich 250 Kc ze schematu.
        ...(data.role === 'ZVUKAR' && data.hourlyRate
          ? { hourlyRate: parseInt(data.hourlyRate, 10) || null }
          : {}),
        ...(data.role === 'HEREC'
          ? {
              studioLocations: data.studioLocations || [],
              birthNumber: data.birthNumber || null,
              ic: data.ic || null,
              dic: data.dic || null,
              vatPayer: data.vatPayer ?? false,
              bankAccount: data.bankAccount || null,
              addressStreet: data.addressStreet || null,
              addressCity: data.addressCity || null,
              addressZip: data.addressZip || null,
              addressCountry: data.addressCountry || null,
            }
          : {}),
      },
      select: { id: true, code: true, email: true, name: true, phone: true, role: true, companyId: true, caflouTag: true, createdAt: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/users selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Účet se nepodařilo založit (${message}).` }, { status: 500 });
  }
}
