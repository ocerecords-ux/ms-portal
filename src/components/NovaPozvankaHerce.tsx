'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Tlačítko „Nová pozvánka" (zadání 16. 9. 2026: „po stisknutí se zadá do pole
 * jen e-mail").
 *
 * JEDNO POLE A NIC VÍC. Jméno, adresu ani číslo účtu tu nikdo neopisuje —
 * herec si je vyplní sám hned po tom, co si nastaví heslo.
 *
 * Stejná komponenta stojí na dvou místech: v Uživatelích u herců a na stránce
 * Pozvánky, kam se dostane i Produkce.
 */
export function NovaPozvankaHerce({ hotovo }: { hotovo?: () => void }) {
  const t = usePreklad();
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  const [email, setEmail] = useState('');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [zprava, setZprava] = useState<string | null>(null);

  async function posli(e: React.FormEvent) {
    e.preventDefault();
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    setOdkaz(null);
    setZprava(null);
    try {
      const res = await fetch('/api/pozvanky/herec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('pozvanka.neodeslana'));
        if (data?.odkaz) setOdkaz(data.odkaz);
        return;
      }
      setZprava(t('pozvanka.odeslanaNa', { email: data.email }));
      setEmail('');
      router.refresh();
      hotovo?.();
    } catch {
      setChyba(t('pozvanka.neodeslana'));
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
        + {t('pozvanka.nova')}
      </button>
    );
  }

  return (
    <form onSubmit={posli} className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-3 min-w-[280px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-heading font-semibold text-ink">{t('pozvanka.novaHerci')}</span>
        <button
          type="button"
          onClick={() => setOtevreno(false)}
          className="text-xs font-heading text-muted bg-transparent border-0 p-0 cursor-pointer"
        >
          {t('obecne.zavrit')}
        </button>
      </div>

      <p className="text-xs font-body text-muted m-0">
        {t('pozvanka.vysvetleni')}
      </p>

      <div className="flex gap-2 flex-wrap">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoFocus
          required
          placeholder={t('pozvanka.emailHerce')}
          className="admin-input flex-1 min-w-[200px]"
        />
        <button
          type="submit"
          disabled={bezi}
          className="text-sm font-heading font-semibold rounded-lg bg-brand-purple text-white px-4 py-2 disabled:opacity-60"
        >
          {bezi ? t('pozvanka.odesilam') : t('pozvanka.poslat')}
        </button>
      </div>

      {zprava && <p className="text-sm font-body text-brand-greenDeep m-0">{zprava}</p>}
      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
      {odkaz && (
        <input readOnly value={odkaz} className="admin-input text-xs" onFocus={(e) => e.target.select()} />
      )}
    </form>
  );
}
