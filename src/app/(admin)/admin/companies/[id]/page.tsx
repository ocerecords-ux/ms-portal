import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { CompanyForm } from './CompanyForm';
import { NotifikaceFirmyPanel } from './NotifikaceFirmyPanel';
import { ROLE_LABELS } from '@/lib/roles';

// Uzivatele se od 5. 9. 2026 zakladaji a edituji centralne na /admin/users
// (parujou se s firmou vyberem, viz NewUserForm/UserEditForm) - tady je jen
// prehled uctu teto firmy s odkazem na editaci.
/**
 * Zalozky na karte firmy (zadani 10. 9. 2026: "ty notifikace u firmy udelej
 * jako samostatnou zalozku nahore").
 *
 * Zalozka se drzi v adrese (?zalozka=notifikace), ne ve stavu komponenty:
 * stranka tak zustava serverova, da se na konkretni zalozku poslat odkaz
 * a po ulozeni se clovek vrati tam, kde byl.
 */
type Zalozka = 'udaje' | 'notifikace' | 'ucty';

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { zalozka?: string };
}) {
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: { users: { orderBy: { createdAt: 'asc' } } },
  });
  if (!company) notFound();

  // Dodavatel nema projekty ani prihlasovaci ucty - zbyde mu jen jedna
  // zalozka a lista se u nej vubec neukazuje.
  const jeKlient = company.type === 'KLIENT';
  const zalozky: { klic: Zalozka; label: string }[] = jeKlient
    ? [
        { klic: 'udaje', label: 'Údaje firmy' },
        { klic: 'notifikace', label: 'Notifikace' },
        { klic: 'ucty', label: 'Přihlašovací účty' },
      ]
    : [{ klic: 'udaje', label: 'Údaje firmy' }];

  const zvolena: Zalozka = zalozky.some((z) => z.klic === searchParams?.zalozka)
    ? (searchParams?.zalozka as Zalozka)
    : 'udaje';

  return (
    <section className="flex flex-col gap-8">
      <div>
        <Link href={`/admin?tab=${company.type === 'DODAVATEL' ? 'dodavatele' : 'klienti'}`} className="text-muted text-sm font-heading">
          ← Zpět na seznam firem
        </Link>
        <h1 className="font-display text-3xl text-ink m-0 mt-2">
          {company.name} {company.code && <span className="text-muted text-lg font-heading">({company.code})</span>}
        </h1>
      </div>

      {zalozky.length > 1 && (
        <div className="flex items-center gap-1 border-b border-line -mb-4">
          {zalozky.map((z) => (
            <Link
              key={z.klic}
              href={`/admin/companies/${company.id}?zalozka=${z.klic}`}
              scroll={false}
              className={`px-4 py-2.5 text-sm font-heading font-semibold no-underline border-b-2 -mb-px transition-colors ${
                zvolena === z.klic
                  ? 'border-brand-purple text-brand-purple'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {z.label}
            </Link>
          ))}
        </div>
      )}

      {zvolena === 'udaje' && (
      <div>
        {/* key = company.id - stejny duvod jako key na UserEditForm
            (/admin/users/[id]/page.tsx): bez nej by pri prechodu mezi firmami
            klientsky formular mohl zustat s puvodnimi hodnotami. */}
        {/* Test napojeni na Caflou je od 6. 9. 2026 vypnuty (zadani) -
            komponenta CaflouTestPanel v repu zustava, jen se nezobrazuje. */}
        <CompanyForm key={company.id} company={company} />
      </div>
      )}

      {/* Notifikace klientovi podle stavu projektu (zadani 10. 9. 2026).
          U dodavatele nedava smysl - zadne projekty pod sebou nema. */}
      {jeKlient && zvolena === 'notifikace' && <NotifikaceFirmyPanel companyId={company.id} />}

      {/* Dodavatel nema pod sebou zadne uzivatelske ucty - to maji jen
          klientske firmy (viz COMPANY_ROLES v lib/roles.ts). */}
      {jeKlient && zvolena === 'ucty' && (
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Přihlašovací účty</h2>
            <Link href={`/admin/users?companyId=${company.id}`} className="text-brand-purple text-sm font-heading font-semibold">
              + Spravovat uživatele →
            </Link>
          </div>
          <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="bg-field text-ink font-heading text-xs">
                    <th className="text-left px-4 py-3">Jméno</th>
                    <th className="text-left px-4 py-3">E-mail</th>
                    <th className="text-left px-4 py-3">Telefon</th>
                    <th className="text-left px-4 py-3">Typ přístupu</th>
                    <th className="text-left px-4 py-3">Založen</th>
                  </tr>
                </thead>
                <tbody>
                  {company.users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted text-sm font-body">
                        Tato firma zatím nemá žádný přihlašovací účet.
                      </td>
                    </tr>
                  )}
                  {company.users.map((u) => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="px-4 py-3 text-sm font-heading font-semibold">
                        <Link href={`/admin/users/${u.id}`} className="text-ink hover:text-brand-purple no-underline">
                          {u.name || u.email}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm font-heading">{u.email}</td>
                      <td className="px-4 py-3 text-sm font-heading tabular-nums">{u.phone || '—'}</td>
                      <td className="px-4 py-3 text-sm font-heading">{ROLE_LABELS[u.role]}</td>
                      <td className="px-4 py-3 text-sm font-heading text-muted tabular-nums">
                        {new Intl.DateTimeFormat('cs-CZ').format(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
