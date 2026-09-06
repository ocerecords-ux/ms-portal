import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

// Editace firmy. Typ (Klient/Dodavatel) se po zalozeni uz nemeni.
//
// Od 6. 9. 2026 vede karta firmy fakturacni udaje u OBOU typu (IC, DIC,
// platce DPH, adresa po castech, splatnost) - drive je mel jen dodavatel.
// Sazba za normostranu je nove nepovinna a dava smysl jen u klienta, ktery
// ma zaskrtnute Audioknihy.
const schema = z.object({
  type: z.enum(['KLIENT', 'DODAVATEL']),
  name: z.string().trim().min(1, 'Název firmy je povinný.'),

  ic: z.string().trim().optional(),
  dic: z.string().trim().optional(),
  vatPayer: z.boolean().optional(),
  bankAccount: z.string().trim().optional(),
  addressStreet: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressZip: z.string().trim().optional(),
  addressCountry: z.string().trim().max(2).optional(),
  paymentTermDays: z.string().trim().optional(),

  contactName: z.string().trim().optional(),
  contactEmail: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),

  ratePerPage: z.string().trim().optional(),
  caflouCompanyId: z.string().trim().optional(),
  driveFolderUrl: z.string().trim().optional(),
  dealsAudiobooks: z.boolean().optional(),
  dealsAds: z.boolean().optional(),
  active: z.boolean().optional(),
});

function toIntOrNull(v?: string): number | null {
  if (v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    const company = await prisma.company.update({
      where: { id: params.id },
      data: {
        name: data.name,
        ...(data.ic !== undefined ? { ic: data.ic || null } : {}),
        ...(data.dic !== undefined ? { dic: data.dic || null } : {}),
        ...(data.vatPayer !== undefined ? { vatPayer: data.vatPayer } : {}),
        ...(data.bankAccount !== undefined ? { bankAccount: data.bankAccount || null } : {}),
        ...(data.addressStreet !== undefined ? { addressStreet: data.addressStreet || null } : {}),
        ...(data.addressCity !== undefined ? { addressCity: data.addressCity || null } : {}),
        ...(data.addressZip !== undefined ? { addressZip: data.addressZip || null } : {}),
        ...(data.addressCountry !== undefined ? { addressCountry: data.addressCountry || null } : {}),
        ...(data.paymentTermDays !== undefined ? { paymentTermDays: toIntOrNull(data.paymentTermDays) } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName || null } : {}),
        ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail || null } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone || null } : {}),
        ...(data.type === 'KLIENT'
          ? {
              // Sazba za normostranu dava smysl jen u audioknih - u reklamnich
              // klientu se cena pocita z Ceniku (zadani 6. 9. 2026).
              ratePerPage: data.dealsAudiobooks === false ? null : toIntOrNull(data.ratePerPage),
              caflouCompanyId: data.caflouCompanyId || null,
              driveFolderUrl: data.driveFolderUrl || null,
              ...(data.dealsAudiobooks !== undefined ? { dealsAudiobooks: data.dealsAudiobooks } : {}),
              ...(data.dealsAds !== undefined ? { dealsAds: data.dealsAds } : {}),
            }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    return NextResponse.json(company);
  } catch (err) {
    console.error('PATCH /api/admin/companies/[id] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}
