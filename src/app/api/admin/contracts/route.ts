import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { expandPlaceholders } from '@/lib/contracts';
import { contractValues, newAccessToken, nextContractNumber } from '@/lib/contractsServer';
import { resolveProject } from '@/lib/projectOptions';

// Zalozeni smlouvy ze sablony (zadani 8. 9. 2026). Text se rovnou rozvine -
// dal uz se s nim pracuje jako s obycejnym textem, takze pozdejsi zmena
// sablony nesahne do uz zalozenych smluv.
const schema = z.object({
  issuerCompanyId: z.string().trim().min(1, 'Vyberte, za kterou firmu smlouvu uzavíráte.'),
  templateId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1, 'Vyplňte název smlouvy.').max(200),
  companyId: z.string().trim().optional(),
  signerName: z.string().trim().min(1, 'Vyplňte jméno podepisujícího.').max(200),
  signerEmail: z.string().trim().email('Vyplňte platný e-mail podepisujícího.'),
  caflouProjectId: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const issuer = await prisma.issuerCompany.findUnique({ where: { id: d.issuerCompanyId }, select: { id: true } });
    if (!issuer) return NextResponse.json({ error: 'Vlastní firma nenalezena.' }, { status: 404 });

    const projekt = await resolveProject(d.caflouProjectId);

    const template = d.templateId
      ? await prisma.contractTemplate.findUnique({ where: { id: d.templateId } })
      : null;

    const values = await contractValues({
      issuerCompanyId: d.issuerCompanyId,
      companyId: d.companyId || null,
      signerName: d.signerName,
      signerEmail: d.signerEmail,
      projectName: projekt.projectName,
    });

    const number = await nextContractNumber(d.issuerCompanyId);
    if (!number) return NextResponse.json({ error: 'Nepodařilo se přidělit číslo smlouvy.' }, { status: 409 });

    const contract = await prisma.contract.create({
      data: {
        number,
        title: d.title,
        body: template ? expandPlaceholders(template.body, values) : '',
        issuerCompanyId: d.issuerCompanyId,
        companyId: d.companyId || null,
        signerName: d.signerName,
        signerEmail: d.signerEmail,
        caflouProjectId: projekt.caflouProjectId,
        projectName: projekt.projectName,
        accessToken: newAccessToken(),
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/contracts selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Založení se nezdařilo (${message}).` }, { status: 500 });
  }
}
