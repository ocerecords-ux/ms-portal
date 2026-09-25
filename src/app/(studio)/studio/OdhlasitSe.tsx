'use client';

import { signOut } from 'next-auth/react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/** Odhlášení z kalendáře studia - jediné tlačítko, které v hlavičce chybí. */
export function OdhlasitSe() {
  const t = usePreklad();
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="rounded-pill border border-white/25 px-3 py-1 text-[11px] font-heading font-semibold text-white/85 hover:text-white hover:border-white/50 transition-colors bg-transparent cursor-pointer"
    >
      {t('listou.odhlasit')}
    </button>
  );
}
