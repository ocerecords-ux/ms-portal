'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Založí prázdný článek a rovnou ho otevře k psaní (zadání 16. 9. 2026).
 *
 * Od 28. 9. 2026 slouží i Procesům - je to tentýž model, liší se jen druhem
 * (viz lib/navody.ts), takže zakládání nemá smysl psát dvakrát.
 */
export function NovyClanekButton({
  druh = 'NAVOD',
  popisek,
}: {
  druh?: 'NAVOD' | 'PROCES';
  /** Bez popisku se vezme „+ Nový návod" ze slovníku. */
  popisek?: string;
} = {}) {
  const router = useRouter();
  const t = usePreklad();
  const [nazev, setNazev] = useState('');
  const [otevreno, setOtevreno] = useState(false);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function zaloz(e: React.FormEvent) {
    e.preventDefault();
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/navody', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, druh }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('navod.nezalozen'));
        return;
      }
      router.push(`/admin/navody/${data.id}`);
    } catch {
      setChyba(t('navod.nezalozen'));
    } finally {
      setBezi(false);
    }
  }

  if (!otevreno) {
    return (
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-5 py-2.5"
      >
        {popisek ?? t('navod.novyNavod')}
      </button>
    );
  }

  return (
    <form onSubmit={zaloz} className="flex flex-col gap-2 min-w-[280px]">
      <div className="flex gap-2 flex-wrap">
        <input
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          autoFocus
          required
          placeholder={t(druh === 'PROCES' ? 'navod.nazevPostupu' : 'navod.nazevNavodu')}
          className="admin-input flex-1 min-w-[180px]"
        />
        <button
          type="submit"
          disabled={bezi}
          className="text-sm font-heading font-semibold rounded-lg bg-brand-purple text-white px-4 py-2 disabled:opacity-60"
        >
          {bezi ? t('navod.zakladam') : t('navod.zalozit')}
        </button>
      </div>
      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
    </form>
  );
}

/** Původní název kvůli stránce Návodů - ať se nemusí měnit na dvou místech. */
export function NovyNavodButton() {
  return <NovyClanekButton />;
}
