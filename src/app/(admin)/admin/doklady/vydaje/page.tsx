import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/doklady';
import { ensureExpenseCategories, expenseTotalMinor, stavUhrady, uhrazenoMinor, zbyvaMinor } from '@/lib/expenses';
import { ibanZTuzemskehoUctu, jeIbanPlatny, spdRetezec } from '@/lib/pdf/qrPlatba';
import { NewExpenseForm } from './NewExpenseForm';
import { StahnoutPrilohy } from '../StahnoutPrilohy';
import { CategoryManager } from './CategoryManager';
import { VydajeTabulka, type VydajRadek } from './VydajeTabulka';
import { listProjectOptions } from '@/lib/projectOptions';
import { nactiStavPosty } from '@/lib/postaServer';
import { PostaTlacitko } from './PostaTlacitko';

// Prijate doklady (zadani 6. 9. 2026). Zalozky Uhrazeno / Neuhrazeno stejne
// jako Aktivni / Dokoncene u projektu, nahore soucty.
export const dynamic = 'force-dynamic';

// Zalozka "Vse" tu byla navic (zadani 8. 9. 2026) - uhrazene a neuhrazene
// pokryvaji vsechno.
// Zalozka "Nezarazene" pribyla 12. 9. 2026 s doklady ze schranky: co prijde
// mailem, ceka tady na prekontrolovani a teprve zarazenim se dostane mezi
// ostatni vydaje (a do souctu).
const TABS = [
  { key: 'nezarazene', label: 'Nezařazené', where: { stav: 'NEZARAZENY' as const } },
  { key: 'neuhrazene', label: 'Neuhrazené', where: { stav: 'ZARAZENY' as const, paid: false } },
  { key: 'uhrazene', label: 'Uhrazené', where: { stav: 'ZARAZENY' as const, paid: true } },
] as const;

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('cs-CZ').format(date) : '—';
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { tab?: string; kategorie?: string; projekt?: string };
}) {
  await ensureExpenseCategories();

  // Vychozi zustavaji Neuhrazene - je to to, co ucetni resi nejcasteji.
  const activeTab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[1];
  const categoryFilter = searchParams?.kategorie || '';

  const [expenses, categories, issuers, pocty, posta] = await Promise.all([
    prisma.expense.findMany({
      where: {
        ...activeTab.where,
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      include: {
        category: true,
        supplier: { select: { name: true, bankAccount: true } },
        // Castecne uhrady (25. 9. 2026) - z nich se pocita, kolik zbyva.
        uhrady: { select: { castkaMinor: true } },
      },
    }),
    prisma.expenseCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { expenses: true } } },
    }),
    prisma.issuerCompany.findMany({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true, defaultCurrency: true },
    }),
    Promise.all([
      prisma.expense.count({ where: { stav: 'NEZARAZENY' } }),
      prisma.expense.count({ where: { stav: 'ZARAZENY', paid: false } }),
      prisma.expense.count({ where: { stav: 'ZARAZENY', paid: true } }),
    ]),
    nactiStavPosty(),
  ]);

  const projects = await listProjectOptions();

  const countFor = (key: (typeof TABS)[number]['key']) =>
    key === 'nezarazene' ? pocty[0] : key === 'neuhrazene' ? pocty[1] : pocty[2];

  // Soucty za to, co je zrovna videt - po menach, at se nescitaji jablka s hruskami.
  // Od 25. 9. 2026 i "zbyva doplatit": u dokladu placenych na vicekrat neni
  // soucet celkovych castek to, co je jeste potreba poslat.
  const totals = new Map<string, { exVat: number; incVat: number; zbyva: number }>();
  for (const e of expenses) {
    const current = totals.get(e.currency) ?? { exVat: 0, incVat: 0, zbyva: 0 };
    const celkem = expenseTotalMinor(e.amountExVatMinor, e.vatRate);
    current.exVat += e.amountExVatMinor;
    current.incVat += celkem;
    current.zbyva += zbyvaMinor(celkem, uhrazenoMinor(e.uhrady, celkem, e.paid));
    totals.set(e.currency, current);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Radky pro tabulku. Texty se formatuji uz tady na serveru, do prohlizece
  // jde jen hotovy retezec a k nemu cislo, podle ktereho se ma radit -
  // podle naformatovaneho textu by razeni nefungovalo ("9. 10." je jako text
  // vetsi nez "10. 9." a stovka s mezerami se nesecte).
  const radkyTabulky: VydajRadek[] = expenses.map((e) => {
    const poSplatnosti = Boolean(!e.paid && e.dueDate && new Date(e.dueDate) < today);
    const podnadpis = [
      e.supplier?.name || e.supplierName,
      e.number ? `č. ${e.number}` : null,
      e.projectName,
      // U dokladu ze schranky je odesilatel to hlavni voditko, nez se doklad
      // precte - ucetni podle nej pozna, o co jde, i z nazvu "faktura.pdf".
      e.stav === 'NEZARAZENY' && e.mailOd ? `z mailu · ${e.mailOd}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    /**
     * QR PLATBA UŽ V PŘEHLEDU (zadání 15. 9. 2026). Řetězec skládá server,
     * v prohlížeči se z něj po kliknutí jen vykreslí čtverečky. Bez účtu
     * (nebo u zaplaceného dokladu) se ikonka vůbec neukáže.
     */
    const ucet = e.supplierAccount?.trim() || e.supplier?.bankAccount?.trim() || null;
    const iban = ucet ? (jeIbanPlatny(ucet) ? ucet.replace(/\s/g, '').toUpperCase() : ibanZTuzemskehoUctu(ucet)) : null;
    const celkemMinor = expenseTotalMinor(e.amountExVatMinor, e.vatRate);
    // U dokladu placeneho na vicekrat se plati zbytek, ne cela castka znovu.
    const uhrazeno = uhrazenoMinor(e.uhrady, celkemMinor, e.paid);
    const zbyva = zbyvaMinor(celkemMinor, uhrazeno);
    const castecne = stavUhrady(celkemMinor, uhrazeno) === 'CAST';
    const kUhrade = zbyva;
    const qrText =
      iban && !e.paid
        ? spdRetezec({
            iban,
            castkaMinor: kUhrade,
            mena: e.currency,
            variabilniSymbol: e.number,
            zprava: [e.supplier?.name || e.supplierName, e.projectName].filter(Boolean).join(' - ') || e.description,
            splatnost: e.dueDate,
          })
        : null;

    return {
      id: e.id,
      nazev: e.description || 'Bez názvu',
      qrText,
      ucet,
      prijemce: e.supplier?.name || e.supplierName || '—',
      cisloDokladu: e.number,
      podnadpis: podnadpis || null,
      maPrilohu: Boolean(e.attachmentUrl),
      datum: formatDate(e.issueDate),
      datumMs: e.issueDate ? new Date(e.issueDate).getTime() : null,
      kategorie: e.category?.name || '—',
      splatnost: formatDate(e.dueDate),
      splatnostMs: e.dueDate ? new Date(e.dueDate).getTime() : null,
      poSplatnosti,
      bezDph: formatMoney(e.amountExVatMinor, e.currency),
      bezDphMinor: e.amountExVatMinor,
      celkem: formatMoney(celkemMinor, e.currency),
      celkemMinor,
      dph: e.vatRate === 0 ? 'bez DPH' : `DPH ${e.vatRate} %`,
      uhrazeno: e.paid,
      castecne,
      zbyva: formatMoney(zbyva, e.currency),
      zbyvaMinor: zbyva,
    };
  });

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      <div className="flex items-end justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 w-[calc(100%+2rem)] sm:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const active = tab.key === activeTab.key;
            const href = `/admin/doklady/vydaje?tab=${tab.key}${categoryFilter ? `&kategorie=${categoryFilter}` : ''}`;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-heading font-semibold rounded-pill no-underline transition-colors ${
                  active ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label} <span className="tabular-nums opacity-80">({countFor(tab.key)})</span>
              </Link>
            );
          })}
        </div>
        {/* Na telefonu se doklady nezakládají (21. 9. 2026: „takto zredukujme i stránku Doklady v mobilu") - stejně jako Nový projekt. */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          {/* Přílohy dokladů za měsíc v jednom ZIPu (zadání 16. 9. 2026) -
              jednou měsíčně to jde účetní. */}
          <StahnoutPrilohy druh="vydaje" />
          <PostaTlacitko stav={posta} />
          <NewExpenseForm
            categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
            issuers={issuers.map((i) => ({
              id: i.id,
              name: i.name,
              isDefault: i.isDefault,
              currency: i.defaultCurrency,
            }))}
            projects={projects.map((p) => ({ id: p.id, label: p.label, finished: p.finished }))}
            vychoziProjekt={searchParams?.projekt || null}
          />
        </div>
      </div>

      {/* Soucty za aktualni vyber */}
      {totals.size > 0 && (
        <div className="bg-surface rounded-card border border-line shadow-sm px-5 py-4 flex items-center gap-8 flex-wrap">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {activeTab.label} celkem ({expenses.length})
          </span>
          {Array.from(totals.entries()).map(([currency, sum]) => (
            <span key={currency} className="flex items-baseline gap-3">
              <span className="font-display text-xl text-ink tabular-nums">
                {formatMoney(sum.incVat, currency as never)}
              </span>
              <span className="text-xs font-body text-muted tabular-nums">
                bez DPH {formatMoney(sum.exVat, currency as never)}
              </span>
              {/* Kolik z toho je jeste potreba poslat (25. 9. 2026) - u dokladu
                  placenych na vicekrat to neni cela castka. */}
              {sum.zbyva > 0 && sum.zbyva !== sum.incVat && (
                <span className="text-xs font-heading font-semibold text-danger tabular-nums">
                  zbývá {formatMoney(sum.zbyva, currency as never)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Filtr podle kategorie. Sprava kategorii sedi hned vedle (zadani
          8. 9. 2026) - drive byla schovana az uplne dole pod tabulkou. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:whitespace-nowrap">
        <Link
          href={`/admin/doklady/vydaje?tab=${activeTab.key}`}
          className={`px-3 py-1.5 text-xs font-heading font-semibold rounded-pill no-underline transition-colors ${
            !categoryFilter ? 'bg-bar text-white' : 'bg-surface border border-line text-muted hover:text-ink'
          }`}
        >
          Všechny kategorie
        </Link>
        {categories
          .filter((c) => c.active || c._count.expenses > 0)
          .map((c) => (
            <Link
              key={c.id}
              href={`/admin/doklady/vydaje?tab=${activeTab.key}&kategorie=${c.id}`}
              className={`px-3 py-1.5 text-xs font-heading font-semibold rounded-pill no-underline transition-colors ${
                categoryFilter === c.id ? 'bg-bar text-white' : 'bg-surface border border-line text-muted hover:text-ink'
              }`}
              >
                {c.name} <span className="tabular-nums opacity-70">({c._count.expenses})</span>
              </Link>
            ))}
        </div>

        <div className="hidden sm:block">
        <CategoryManager
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            active: c.active,
            usedBy: c._count.expenses,
          }))}
        />
        </div>
      </div>

      <VydajeTabulka radky={radkyTabulky} />

    </div>
  );
}
