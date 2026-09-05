import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nextCode } from '@/lib/codes';

// Firmy se od 5. 9. 2026 deli na Klienty a Dodavatele (viz CompanyType v
// schema.prisma) - kazdy typ ma jina pole, proto discriminated union podle
// "type". Dodavatel nema sazbu/normostranu ani napojeni na Caflou/Disk (to
// dava smysl jen u klientu, kterym Mediaspace fakturuje za stranky), misto
// toho ma fakturacni/kontaktni udaje.
const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('KLIENT'),
    name: z.string().trim().min(1, 'Název firmy je povinný.'),
    ratePerPage: z.coerce.number().int().min(0, 'Sazba musí být kladné číslo.'),
    caflouCompanyId: z.string().trim().optional(),
    driveFolderUrl: z.string().trim().optional(),
    dealsAudiobooks: z.boolean().optional(),
    dealsAds: z.boolean().optional(),
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
  }),
]);

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const code = await nextCode('F');
  const data = parsed.data;

  const company = await prisma.company.create({
    data:
      data.type === 'KLIENT'
        ? {
            code,
            type: 'KLIENT',
            name: data.name,
            ratePerPage: data.ratePerPage,
            caflouCompanyId: data.caflouCompanyId || null,
            driveFolderUrl: data.driveFolderUrl || null,
            // Chybi-li v pozadavku (starsi klient formulare apod.), zustava
            // vychozi hodnota ze schema.prisma (dealsAudiobooks true, dealsAds false).
            ...(data.dealsAudiobooks !== undefined ? { dealsAudiobooks: data.dealsAudiobooks } : {}),
            ...(data.dealsAds !== undefined ? { dealsAds: data.dealsAds } : {}),
          }
        : {
            code,
            type: 'DODAVATEL',
            name: data.name,
            contactName: data.contactName || null,
            contactEmail: data.contactEmail || null,
            contactPhone: data.contactPhone || null,
            ic: data.ic || null,
            dic: data.dic || null,
            vatPayer: data.vatPayer ?? false,
            bankAccount: data.bankAccount || null,
            address: data.address || null,
          },
  });

  return NextResponse.json(company, { status: 201 });
}
