import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { caflouConfigured, listCaflouCompanies, listCaflouProjectsForCompany } from '@/lib/caflou';

// Diagnosticky endpoint - admin si tu muze overit napojeni na Caflou pro
// konkretni firmu a hned videt syrovou odpoved (kvuli doladeni mapovani
// poli, dokud neni presne overena struktura dat z Caflou API). Rezim
// ?list=companies navic vypise vsechny firmy z Caflou (nazev + ID), aby
// admin nemusel ID hledat rucne primo v Caflou.
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  if (!caflouConfigured()) {
    return NextResponse.json({ error: 'Caflou API zatím není nastavené (chybí CAFLOU_API_KEY / CAFLOU_ACCOUNT_ID).' }, { status: 503 });
  }

  if (req.nextUrl.searchParams.get('list') === 'companies') {
    try {
      const result = await listCaflouCompanies();
      return NextResponse.json({ status: result.status, ok: result.ok, body: result.body ?? result.raw });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' }, { status: 502 });
    }
  }

  const companyId = req.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ error: 'Chybí companyId.' }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });
  }
  if (!company.caflouCompanyId) {
    return NextResponse.json({ error: 'Tato firma nemá vyplněné ID firmy v Caflou.' }, { status: 400 });
  }

  try {
    const result = await listCaflouProjectsForCompany(company.caflouCompanyId);
    return NextResponse.json({ status: result.status, ok: result.ok, body: result.body ?? result.raw });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Dotaz na Caflou selhal.' }, { status: 502 });
  }
}
