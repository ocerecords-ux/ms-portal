import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ExpenseEditor } from './ExpenseEditor';
import { listProjectOptions } from '@/lib/projectOptions';
import { expenseTotalMinor, uhrazenoMinor, zbyvaMinor } from '@/lib/expenses';
import { QrPlatba } from '@/components/QrPlatba';
import { NahledPrilohy } from './NahledPrilohy';
import { FakturaKeSmlouve, type KandidatFaktury } from './FakturaKeSmlouve';
import { formatMoney } from '@/lib/doklady';

// Detail prijateho dokladu.
export const dynamic = 'force-dynamic';

export default async function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const [expense, categories, companies] = await Promise.all([
    prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        supplier: { select: { name: true, bankAccount: true } },
        issuer: { select: { name: true } },
        prilohy: { orderBy: { createdAt: 'asc' }, select: { id: true, nazev: true } },
        // Castecne uhrady (25. 9. 2026) - od nejstarsi, jak se plativalo.
        uhrady: { orderBy: { datum: 'asc' } },
      },
    }),
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.company.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!expense) notFound();

  const projects = await listProjectOptions();

  /**
   * DODATEČNÁ FAKTURA KE SMLOUVĚ (zadání 25. 9. 2026: „my vytvoříme herci
   * smlouvu a na základě té smlouvy je platíme. Akorát někteří ještě pošlou
   * dodatečně fakturu… potřebuji, ať se počítá jeden a ať vím, že mám zaplatit
   * ten s DPH"). Karta se ukazuje jen u dokladu, který vznikl ze smlouvy.
   */
  const zeSmlouvy = expense.zdroj === 'SMLOUVA' || Boolean(expense.fakturaCislo);
  const smlouva = zeSmlouvy
    ? await prisma.contract.findUnique({ where: { vydajId: expense.id }, select: { number: true } })
    : null;

  /**
   * Co by mohla být ta faktura: neuhrazený doklad, který nevznikl ze smlouvy -
   * buď od stejného dodavatele nebo na stejném projektu, a k tomu všechno, co
   * leží nezařazené ze schránky účtárny.
   */
  const kandidati: KandidatFaktury[] =
    zeSmlouvy && !expense.fakturaCislo
      ? (
          await prisma.expense.findMany({
            where: {
              id: { not: expense.id },
              paid: false,
              zdroj: { not: 'SMLOUVA' },
              OR: [
                ...(expense.supplierCompanyId ? [{ supplierCompanyId: expense.supplierCompanyId }] : []),
                ...(expense.caflouProjectId ? [{ caflouProjectId: expense.caflouProjectId }] : []),
                { stav: 'NEZARAZENY' as const },
              ],
            },
            orderBy: { issueDate: 'desc' },
            take: 30,
            select: {
              id: true,
              number: true,
              supplierName: true,
              supplier: { select: { name: true } },
              amountExVatMinor: true,
              vatRate: true,
              currency: true,
              issueDate: true,
              projectName: true,
            },
          })
        ).map((d) => ({
          id: d.id,
          popis: [
            d.number || 'bez čísla',
            d.supplier?.name || d.supplierName || '—',
            formatMoney(expenseTotalMinor(d.amountExVatMinor, d.vatRate), d.currency),
            new Intl.DateTimeFormat('cs-CZ').format(d.issueDate),
            d.projectName,
          ]
            .filter(Boolean)
            .join(' · '),
        }))
      : [];

  // Ucet je bud primo na dokladu (dorazil ze smlouvy s hercem), nebo u firmy
  // dodavatele. Kdyz neni ani jeden, QR se nekresli.
  const ucetPrijemce = expense.supplierAccount?.trim() || expense.supplier?.bankAccount?.trim() || null;
  const celkemMinor = expenseTotalMinor(expense.amountExVatMinor, expense.vatRate);
  /**
   * QR SE KRESLÍ NA TO, CO ZBÝVÁ (25. 9. 2026). U dokladu placeného na
   * vícekrát by kód na celou částku poslal podruhé všechno znovu.
   */
  const jizUhrazeno = uhrazenoMinor(expense.uhrady, celkemMinor, expense.paid);
  const kUhrade = zbyvaMinor(celkemMinor, jizUhrazeno);
  const prijemce = expense.supplier?.name ?? expense.supplierName ?? null;

  /**
   * NÁHLED PŘÍLOHY VEDLE FORMULÁŘE (zadání 16. 9. 2026: „ať se mi na pravé
   * straně obrazovky zobrazí rovnou náhled té přílohy").
   *
   * Účtenku člověk při vyplňování opisuje - částku, datum, dodavatele - a
   * otevírat ji na druhé záložce znamená přepínat u každého políčka. Doklad
   * bez přílohy zůstává úzký jako dřív; roztažená stránka s prázdnou půlkou
   * by vypadala rozbitě.
   */
  const maPrilohu = Boolean(expense.attachmentUrl);

  return (
    <div className={`flex flex-col gap-6 ${maPrilohu ? 'max-w-[1400px]' : 'max-w-3xl'}`}>
      <Link href="/admin/doklady/vydaje" className="text-muted text-sm font-heading no-underline">
        ← Zpět na výdaje
      </Link>

      <div
        className={
          maPrilohu
            ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(420px,44%)] gap-6 items-start'
            : ''
        }
      >
        <div className="flex flex-col gap-6 min-w-0">

      {!expense.paid && (
        <QrPlatba
          ucet={ucetPrijemce}
          castkaMinor={kUhrade}
          mena={expense.currency}
          variabilniSymbol={expense.number}
          zprava={[prijemce, expense.projectName].filter(Boolean).join(' - ') || expense.description}
          splatnost={expense.dueDate}
          prijemce={prijemce}
        />
      )}

      <ExpenseEditor
        expense={{
          id: expense.id,
          number: expense.number ?? '',
          supplierCompanyId: expense.supplierCompanyId ?? '',
          supplierName: expense.supplierName ?? '',
          supplierLabel: expense.supplier?.name ?? expense.supplierName ?? '—',
          categoryId: expense.categoryId ?? '',
          issuerName: expense.issuer?.name ?? null,
          currency: expense.currency,
          exchangeRate: expense.exchangeRate,
          exchangeRateDate: expense.exchangeRateDate ? expense.exchangeRateDate.toISOString() : null,
          description: expense.description ?? '',
          amountExVatMinor: expense.amountExVatMinor,
          vatRate: expense.vatRate,
          issueDate: expense.issueDate.toISOString().slice(0, 10),
          dueDate: expense.dueDate ? expense.dueDate.toISOString().slice(0, 10) : '',
          paid: expense.paid,
          paidAt: expense.paidAt ? expense.paidAt.toISOString() : null,
          paymentMethod: expense.paymentMethod,
          attachmentUrl: expense.attachmentUrl,
          attachmentName: expense.attachmentName,
          note: expense.note ?? '',
          caflouProjectId: expense.caflouProjectId ?? '',
          projectName: expense.projectName,
          stav: expense.stav,
          mailOd: expense.mailOd,
          mailPredmet: expense.mailPredmet,
          mailPrijatoAt: expense.mailPrijatoAt ? expense.mailPrijatoAt.toISOString() : null,
          navrhJson: expense.navrhJson,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        companies={companies}
        projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
        dalsiPrilohy={expense.prilohy}
        uhrady={expense.uhrady.map((u) => ({
          id: u.id,
          castkaMinor: u.castkaMinor,
          datum: u.datum.toISOString(),
          zpusob: u.zpusob,
          poznamka: u.poznamka,
          kdoJmeno: u.kdoJmeno,
        }))}
      />

      {zeSmlouvy && (
        <FakturaKeSmlouve
          expenseId={expense.id}
          smlouvaCislo={smlouva?.number ?? null}
          faktura={
            expense.fakturaAt
              ? { cislo: expense.fakturaCislo, at: expense.fakturaAt.toISOString() }
              : null
          }
          celkemMinor={celkemMinor}
          bezDphMinor={expense.amountExVatMinor}
          sazba={expense.vatRate}
          mena={expense.currency}
          kandidati={kandidati}
        />
      )}
        </div>

        {/* Náhled drží na místě i při rolování formuláře - jinak by u delšího
            dokladu zmizel nahoře a byl by k ničemu. */}
        {maPrilohu && (
          <div className="xl:sticky xl:top-6">
            <NahledPrilohy expenseId={expense.id} nazev={expense.attachmentName} />
          </div>
        )}
      </div>
    </div>
  );
}
