import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { expandNumberFormat } from '@/lib/doklady';
import { resolveProject } from '@/lib/projectOptions';

// Zalozeni nabidky (zadani 6. 9. 2026). Cislo se bere z ciselne rady vlastni
// firmy a rada se rovnou posune - v transakci, aby dve soubezne nabidky
// nedostaly stejne cislo.
// Nabidka se zaklada az z hotoveho dokladu (zadani 10. 9. 2026: "dej pryc
// ten mezikrok, rovnou po kliknuti ukaz nahled") - proto sem chodi vsechno,
// co clovek v editoru vyplnil, ne jen tri pole.
const itemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number(),
  unit: z.string().trim().max(20).optional(),
  unitPriceMinor: z.number().int(),
  vatRate: z.number().int(),
});

const schema = z.object({
  issuerCompanyId: z.string().trim().min(1, 'Vyberte, za kterou firmu nabídku vystavujete.'),
  companyId: z.string().trim().min(1, 'Vyberte odběratele.'),
  subject: z.string().trim().max(200).optional(),
  note: z.string().trim().max(3000).optional(),
  currency: z.enum(['CZK', 'EUR', 'GBP']).optional(),
  issueDate: z.string().trim().min(8).optional(),
  validUntil: z.string().trim().nullable().optional(),
  caflouProjectId: z.string().trim().nullable().optional(),
  jazyk: z.enum(['CS', 'EN']).optional(),
  items: z.array(itemSchema).max(100).optional(),
});

/** "2026-09-08" -> Date; co neni datum, bereme jako nevyplnene. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const input = parsed.data;
    const { issuerCompanyId, companyId, subject } = input;

    const issuer = await prisma.issuerCompany.findUnique({ where: { id: issuerCompanyId } });
    if (!issuer) return NextResponse.json({ error: 'Vlastní firma nenalezena.' }, { status: 404 });

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: 'Odběratel nenalezen.' }, { status: 404 });

    const projekt = await resolveProject(input.caflouProjectId ?? null);
    const polozky = input.items ?? [];

    // Kdyby cislo uz existovalo (rucne posunuta rada, souběh), zkusime dalsi.
    let created = null;
    let sequence = issuer.offerNextNumber;
    for (let attempt = 0; attempt < 20 && !created; attempt++) {
      const number = expandNumberFormat(issuer.offerNumberFormat, sequence);
      const exists = await prisma.offer.findUnique({ where: { number }, select: { id: true } });
      if (exists) {
        sequence += 1;
        continue;
      }
      created = await prisma.$transaction(async (tx) => {
        const offer = await tx.offer.create({
          data: {
            number,
            issuerCompanyId,
            companyId,
            currency: input.currency ?? issuer.defaultCurrency,
            subject: subject || null,
            note: input.note || null,
            jazyk: input.jazyk ?? 'CS',
            ...(toDate(input.issueDate) ? { issueDate: toDate(input.issueDate)! } : {}),
            validUntil: toDate(input.validUntil),
            ...(projekt.caflouProjectId
              ? { caflouProjectId: projekt.caflouProjectId, projectName: projekt.projectName }
              : {}),
            approvalToken: randomBytes(24).toString('base64url'),
            ...(polozky.length > 0
              ? {
                  items: {
                    create: polozky.map((item, index) => ({
                      description: item.description,
                      quantity: item.quantity,
                      unit: item.unit || 'ks',
                      unitPriceMinor: item.unitPriceMinor,
                      vatRate: item.vatRate,
                      sortOrder: index,
                    })),
                  },
                }
              : {}),
          },
        });
        await tx.issuerCompany.update({
          where: { id: issuerCompanyId },
          data: { offerNextNumber: sequence + 1 },
        });
        return offer;
      });
    }

    if (!created) {
      return NextResponse.json({ error: 'Nepodařilo se přidělit číslo nabídky.' }, { status: 409 });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/offers selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Založení se nezdařilo (${message}).` }, { status: 500 });
  }
}
