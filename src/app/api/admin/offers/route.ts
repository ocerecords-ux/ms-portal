import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { expandNumberFormat } from '@/lib/doklady';

// Zalozeni nabidky (zadani 6. 9. 2026). Cislo se bere z ciselne rady vlastni
// firmy a rada se rovnou posune - v transakci, aby dve soubezne nabidky
// nedostaly stejne cislo.
const schema = z.object({
  issuerCompanyId: z.string().trim().min(1, 'Vyberte, za kterou firmu nabídku vystavujete.'),
  companyId: z.string().trim().min(1, 'Vyberte odběratele.'),
  subject: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const { issuerCompanyId, companyId, subject } = parsed.data;

    const issuer = await prisma.issuerCompany.findUnique({ where: { id: issuerCompanyId } });
    if (!issuer) return NextResponse.json({ error: 'Vlastní firma nenalezena.' }, { status: 404 });

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: 'Odběratel nenalezen.' }, { status: 404 });

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
            currency: issuer.defaultCurrency,
            subject: subject || null,
            approvalToken: randomBytes(24).toString('base64url'),
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
