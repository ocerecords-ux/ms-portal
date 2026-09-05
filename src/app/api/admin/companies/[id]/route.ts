import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Editace firmy - typ (Klient/Dodavatel) se po zalozeni uz nemeni (jina
// kategorie firmy = jina firma), formular tedy vzdy posila jen pole
// prislusna k typu, ktery firma uz ma.
const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('KLIENT'),
    name: z.string().trim().min(1, 'Název firmy je povinný.'),
    ratePerPage: z.coerce.number().int().min(0, 'Sazba musí být kladné číslo.'),
    caflouCompanyId: z.string().trim().optional(),
    driveFolderUrl: z.string().trim().optional(),
    dealsAudiobooks: z.boolean().optional(),
    dealsAds: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('DODAVATEL'),
    name: z.string().trim().min(1, 'Název firmy je povinný.'),
    contactName: z.string().trim().optional(),
    contactEmail: z.string().trim().optional(),
    contactPhone: z.string().trim().optional(),
    ic: z.string().trim().optional(),
    dic: z.string().trim().optional(),
    vatPayer: z.boolean().optional(),
    bankAccount: z.string().trim().optional(),
    address: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const data = parsed.data;

  const company = await prisma.company.update({
    where: { id: params.id },
    data:
      data.type === 'KLIENT'
        ? {
            name: data.name,
            ratePerPage: data.ratePerPage,
            caflouCompanyId: data.caflouCompanyId || null,
            driveFolderUrl: data.driveFolderUrl || null,
            ...(data.dealsAudiobooks !== undefined ? { dealsAudiobooks: data.dealsAudiobooks } : {}),
            ...(data.dealsAds !== undefined ? { dealsAds: data.dealsAds } : {}),
            ...(data.active !== undefined ? { active: data.active } : {}),
          }
        : {
            name: data.name,
            contactName: data.contactName || null,
            contactEmail: data.contactEmail || null,
            contactPhone: data.contactPhone || null,
            ic: data.ic || null,
            dic: data.dic || null,
            vatPayer: data.vatPayer ?? false,
            bankAccount: data.bankAccount || null,
            address: data.address || null,
            ...(data.active !== undefined ? { active: data.active } : {}),
          },
  });

  return NextResponse.json(company);
}
