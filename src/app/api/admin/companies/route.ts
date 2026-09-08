import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nextCode } from '@/lib/codes';

// Firmy se od 5. 9. 2026 deli na Klienty a Dodavatele (viz CompanyType v
// schema.prisma). Fakturacni udaje (IC, DIC, platce DPH, adresa po castech,
// cislo uctu) i kontakt vedeme od 8. 9. 2026 u OBOU typu - firma tak jde
// zalozit rovnou kompletni, vcetne nacteni z registru podle IC, bez
// dodatecneho otevirani detailu (zadani 8. 9. 2026).
const commonFields = {
  name: z.string().trim().min(1, 'Název firmy je povinný.'),
  ic: z.string().trim().optional(),
  dic: z.string().trim().optional(),
  vatPayer: z.boolean().optional(),
  bankAccount: z.string().trim().optional(),
  addressStreet: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressZip: z.string().trim().optional(),
  addressCountry: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactEmail: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  // Zpetna kompatibilita se starsim formularem dodavatele (jednoradkova adresa).
  address: z.string().trim().optional(),
};

const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('KLIENT'),
    ...commonFields,
    // Sazba se vyplnuje jen u klienta poptavajiciho audioknihy - u reklamnich
    // se cena pocita z Ceniku, proto neni povinna.
    ratePerPage: z.coerce.number().int().min(0).optional(),
    caflouCompanyId: z.string().trim().optional(),
    driveFolderUrl: z.string().trim().optional(),
    dealsAudiobooks: z.boolean().optional(),
    dealsAds: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('DODAVATEL'),
    ...commonFields,
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

  const shared = {
    code,
    name: data.name,
    ic: data.ic || null,
    dic: data.dic || null,
    vatPayer: data.vatPayer ?? false,
    bankAccount: data.bankAccount || null,
    addressStreet: data.addressStreet || null,
    addressCity: data.addressCity || null,
    addressZip: data.addressZip || null,
    addressCountry: data.addressCountry || 'CZ',
    // Jednoradkova adresa zustava kvuli starsim zaznamum - slozime ji z casti.
    address:
      data.address ||
      [data.addressStreet, [data.addressZip, data.addressCity].filter(Boolean).join(' ')].filter(Boolean).join(', ') ||
      null,
    contactName: data.contactName || null,
    contactEmail: data.contactEmail || null,
    contactPhone: data.contactPhone || null,
  };

  const company = await prisma.company.create({
    data:
      data.type === 'KLIENT'
        ? {
            ...shared,
            type: 'KLIENT',
            ratePerPage: data.ratePerPage ?? 0,
            caflouCompanyId: data.caflouCompanyId || null,
            driveFolderUrl: data.driveFolderUrl || null,
            // Chybi-li v pozadavku, zustava vychozi hodnota ze schema.prisma
            // (dealsAudiobooks true, dealsAds false).
            ...(data.dealsAudiobooks !== undefined ? { dealsAudiobooks: data.dealsAudiobooks } : {}),
            ...(data.dealsAds !== undefined ? { dealsAds: data.dealsAds } : {}),
          }
        : {
            ...shared,
            type: 'DODAVATEL',
          },
  });

  return NextResponse.json(company, { status: 201 });
}
