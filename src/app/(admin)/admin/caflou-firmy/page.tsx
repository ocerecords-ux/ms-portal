import { prisma } from '@/lib/db';
import { comparableCompanyName } from '@/lib/caflouCompanies';
import { CaflouCompaniesBrowser } from './CaflouCompaniesBrowser';

// Firmy z Caflou (zadani 8. 9. 2026). Surovy seznam k roztrideni na klienty a
// herce - do modelu Company (tenant portalu) se nic nezaklada automaticky,
// prave kvuli duplicitam s tim, co uz v portalu je.
export const dynamic = 'force-dynamic';

export default async function CaflouCompaniesPage() {
  const [rows, companies, people] = await Promise.all([
    prisma.caflouCompany.findMany({ orderBy: { name: 'asc' }, take: 3000 }),
    prisma.company.findMany({ select: { id: true, name: true, ic: true, caflouCompanyId: true } }),
    // Herci uz zalozeni v portalu - at je videt, ze uz je nemusime zakladat znovu.
    prisma.user.findMany({
      where: { role: 'HEREC' },
      select: { id: true, name: true, email: true, ic: true },
    }),
  ]);

  // Rejstriky pro hledani duplicit. Nazev se porovnava bez diakritiky a bez
  // pravni formy ("s.r.o."), protoze v Caflou a v portalu byva zapsany jinak.
  const companyByCaflouId = new Map(
    companies.filter((c) => c.caflouCompanyId).map((c): [string, string] => [String(c.caflouCompanyId), c.name]),
  );
  const companyByIc = new Map(
    companies.filter((c) => c.ic).map((c): [string, string] => [String(c.ic).replace(/\D/g, ''), c.name]),
  );
  const companyByName = new Map(companies.map((c): [string, string] => [comparableCompanyName(c.name), c.name]));
  const personByIc = new Map(
    people.filter((p) => p.ic).map((p): [string, string] => [String(p.ic).replace(/\D/g, ''), p.name || p.email]),
  );
  const personByName = new Map(
    people.map((p): [string, string] => [comparableCompanyName(p.name || p.email), p.name || p.email]),
  );

  const items = rows.map((row) => {
    const ic = row.ic ? row.ic.replace(/\D/g, '') : '';
    const key = comparableCompanyName(row.name);

    let existing: { label: string; where: string } | null = null;
    if (companyByCaflouId.has(row.id)) {
      existing = { label: companyByCaflouId.get(row.id)!, where: 'Firmy (napojeno na Caflou)' };
    } else if (ic && companyByIc.has(ic)) {
      existing = { label: companyByIc.get(ic)!, where: 'Firmy (shodné IČ)' };
    } else if (ic && personByIc.has(ic)) {
      existing = { label: personByIc.get(ic)!, where: 'Herci (shodné IČ)' };
    } else if (key && companyByName.has(key)) {
      existing = { label: companyByName.get(key)!, where: 'Firmy (shodný název)' };
    } else if (key && personByName.has(key)) {
      existing = { label: personByName.get(key)!, where: 'Herci (shodný název)' };
    }

    return {
      id: row.id,
      name: row.name,
      ic: row.ic,
      email: row.email,
      phone: row.phone,
      city: row.addressCity,
      kind: row.kind,
      kindReason: row.kindReason,
      existing,
    };
  });

  return <CaflouCompaniesBrowser items={items} />;
}
