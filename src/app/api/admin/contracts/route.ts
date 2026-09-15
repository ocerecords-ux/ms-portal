import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { CONTRACT_PLACEHOLDERS, castkaDoSmlouvy, expandPlaceholders } from '@/lib/contracts';
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
  /** Herec z projektu - z jeho karty se vezme adresa a RC nebo IC. */
  actorUserId: z.string().trim().optional(),
  /**
   * Rucne vyplnena pole ze zakladaciho formulare (odmena, termin, ...).
   * Portal je nikde nema, ale bez nich by ve smlouve chybela treba castka
   * (zadani 13. 9. 2026: „na smlouve neni nikde castka").
   */
  pole: z.record(z.string().trim().max(400)).optional(),
});

/** Prijmeme jen pole, ktera sablony opravdu znaji - nic jineho se nedosazuje. */
const RUCNI_KLICE = new Set(CONTRACT_PLACEHOLDERS.filter((p) => p.rucne).map((p) => p.key));

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

    // Cislo se pridava pred rozvinutim textu - sablony maji {{cislo_smlouvy}}
    // rovnou v zahlavi, stejne jako to maji papirove smlouvy.
    const number = await nextContractNumber(d.issuerCompanyId);
    if (!number) return NextResponse.json({ error: 'Nepodařilo se přidělit číslo smlouvy.' }, { status: 409 });

    const values = await contractValues({
      issuerCompanyId: d.issuerCompanyId,
      companyId: d.companyId || null,
      signerName: d.signerName,
      signerEmail: d.signerEmail,
      projectName: projekt.projectName,
      contractNumber: number,
      actorUserId: d.actorUserId || null,
      caflouProjectId: d.caflouProjectId || null,
    });

    const rucni: Record<string, string> = d.pole ?? {};
    for (const [klic, hodnota] of Object.entries(rucni)) {
      if (!RUCNI_KLICE.has(klic) || !hodnota) continue;
      // „30000" je ve smlouve skaredé - do textu patri „30 000 Kč"
      // (zadani 15. 9. 2026).
      values[klic] = klic === 'odmena' ? castkaDoSmlouvy(hodnota) : hodnota;
    }

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
        // Odmena se drzi i zvlast (ne jen ve vete smlouvy) - po podpisu z ni
        // vznikne vydaj (zadani 15. 9. 2026: „podepsane smlouvy by se mely
        // automaticky ulozit do vydaju").
        odmenaText: values.odmena?.trim() || null,
        splatnostText: values.splatnost?.trim() || null,
        actorUserId: d.actorUserId || null,
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
