'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * Tabulka uživatelů v administraci (zadání 9. 9. 2026: „aby byl nejdřív
 * sloupec Jméno. A pak udělej, aby se uživatelé dali řadit stisknutím na
 * název sloupce").
 *
 * Čtyři záložky (Mediaspace / Klienti / Herci / filtr podle firmy) měly dřív
 * čtyři skoro stejné tabulky opsané pod sebou - lišily se jedním prostředním
 * sloupcem. Teď je to jedna tabulka a záložka si jen řekne, které sloupce chce.
 *
 * Řadí se v prohlížeči, ne dotazem na server: uživatelů jsou desítky, takže je
 * to okamžité a nestojí to další načtení stránky.
 */

export type UsersColumn = 'jmeno' | 'kod' | 'email' | 'telefon' | 'role' | 'narozeni' | 'lokace' | 'firma' | 'aktivni';

export type UserRow = {
  id: string;
  code: string | null;
  name: string;
  email: string;
  phone: string | null;
  roleLabel: string;
  active: boolean;
  photoUrl: string | null;
  /** Už naformatované datum + hodnota na řazení. */
  birthDate: string | null;
  birthDateMs: number | null;
  studioLocations: string | null;
  companyName: string | null;
  companyId: string | null;
};

const NADPISY: Record<UsersColumn, string> = {
  jmeno: 'Jméno',
  kod: 'Kód',
  email: 'E-mail',
  telefon: 'Telefon',
  role: 'Typ přístupu',
  narozeni: 'Datum narození',
  lokace: 'Lokace',
  firma: 'Firma',
  aktivni: 'Aktivní',
};

/** Hodnota, podle které se sloupec řadí. null = prázdno, patří vždy dozadu. */
function hodnota(row: UserRow, sloupec: UsersColumn): string | number | null {
  switch (sloupec) {
    case 'jmeno':
      return row.name || row.email;
    case 'kod':
      return row.code;
    case 'email':
      return row.email;
    case 'telefon':
      return row.phone;
    case 'role':
      return row.roleLabel;
    case 'narozeni':
      return row.birthDateMs;
    case 'lokace':
      return row.studioLocations;
    case 'firma':
      return row.companyName;
    case 'aktivni':
      // Aktivní napřed při vzestupném řazení.
      return row.active ? 0 : 1;
  }
}

function porovnej(a: UserRow, b: UserRow, sloupec: UsersColumn, dir: 'asc' | 'desc'): number {
  const x = hodnota(a, sloupec);
  const y = hodnota(b, sloupec);

  // Prázdné hodnoty jdou vždycky nakonec, ať se řadí kterýmkoliv směrem -
  // jinak by půlka tabulky byla po kliknutí jen samé pomlčky.
  const prazdneX = x === null || x === '';
  const prazdneY = y === null || y === '';
  if (prazdneX && prazdneY) return 0;
  if (prazdneX) return 1;
  if (prazdneY) return -1;

  const smer = dir === 'asc' ? 1 : -1;
  if (typeof x === 'number' && typeof y === 'number') return (x - y) * smer;
  return String(x).localeCompare(String(y), 'cs', { numeric: true }) * smer;
}

function Sipka({ dir }: { dir: 'asc' | 'desc' | null }) {
  if (!dir) {
    return (
      <span className="inline-block opacity-40 ml-1" aria-hidden="true">
        ↕
      </span>
    );
  }
  return (
    <span className="inline-block ml-1" aria-hidden="true">
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export function UsersTable({
  rows,
  columns,
  emptyText,
}: {
  rows: UserRow[];
  columns: UsersColumn[];
  emptyText: string;
}) {
  const [sort, setSort] = useState<{ key: UsersColumn; dir: 'asc' | 'desc' }>({ key: 'jmeno', dir: 'asc' });

  const serazene = useMemo(
    () => [...rows].sort((a, b) => porovnej(a, b, sort.key, sort.dir)),
    [rows, sort],
  );

  function prepni(sloupec: UsersColumn) {
    setSort((s) => (s.key === sloupec ? { key: sloupec, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: sloupec, dir: 'asc' }));
  }

  const bunka = 'px-4 py-3.5 text-sm font-heading whitespace-nowrap';

  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-bar text-white font-heading text-xs">
              {columns.map((sloupec) => {
                const aktivni = sort.key === sloupec;
                return (
                  <th key={sloupec} className="text-left px-4 py-3.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => prepni(sloupec)}
                      aria-sort={aktivni ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      title={`Seřadit podle: ${NADPISY[sloupec]}`}
                      className={`font-heading text-xs hover:text-brand-green transition-colors ${
                        aktivni ? 'text-brand-green' : 'text-white'
                      }`}
                    >
                      {NADPISY[sloupec]}
                      <Sipka dir={aktivni ? sort.dir : null} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {serazene.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted text-sm font-body">
                  {emptyText}
                </td>
              </tr>
            )}
            {serazene.map((u) => (
              <tr key={u.id} className="border-t border-line hover:bg-surfaceSoft">
                {columns.map((sloupec) => {
                  switch (sloupec) {
                    case 'jmeno':
                      return (
                        <td key={sloupec} className="px-4 py-3.5 font-heading font-semibold text-sm whitespace-nowrap">
                          <Link href={`/admin/users/${u.id}`} className="text-ink hover:text-brand-purple no-underline">
                            {u.photoUrl && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={u.photoUrl}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover inline-block mr-2 align-middle"
                              />
                            )}
                            {u.name || u.email}
                          </Link>
                        </td>
                      );
                    case 'kod':
                      return (
                        <td key={sloupec} className={`${bunka} text-muted tabular-nums`}>
                          {u.code || '—'}
                        </td>
                      );
                    case 'email':
                      return (
                        <td key={sloupec} className={bunka}>
                          {u.email}
                        </td>
                      );
                    case 'telefon':
                      return (
                        <td key={sloupec} className={`${bunka} tabular-nums`}>
                          {u.phone || '—'}
                        </td>
                      );
                    case 'role':
                      return (
                        <td key={sloupec} className={bunka}>
                          {u.roleLabel}
                        </td>
                      );
                    case 'narozeni':
                      return (
                        <td key={sloupec} className={`${bunka} text-muted tabular-nums`}>
                          {u.birthDate || '—'}
                        </td>
                      );
                    case 'lokace':
                      return (
                        <td key={sloupec} className="px-4 py-3.5 text-sm font-heading text-muted">
                          {u.studioLocations || '—'}
                        </td>
                      );
                    case 'firma':
                      return (
                        <td key={sloupec} className="px-4 py-3.5 text-sm font-heading text-muted">
                          {u.companyName && u.companyId ? (
                            <Link href={`/admin/companies/${u.companyId}`} className="hover:text-brand-purple">
                              {u.companyName}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    case 'aktivni':
                      return (
                        <td key={sloupec} className={bunka}>
                          {u.active ? 'Ano' : <span className="text-danger">Ne</span>}
                        </td>
                      );
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
