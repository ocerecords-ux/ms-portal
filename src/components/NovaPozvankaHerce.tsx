'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
        setChyba(data?.error || 'Pozvánku se nepodařilo odeslat.');
        if (data?.odkaz) setOdkaz(data.odkaz);
        return;
      }
      setZprava(`Pozvánka odešla na ${data.email}.`);
      setEmail('');
      router.refresh();
      hotovo?.();
    } catch {
      setChyba('Pozvánku se nepodařilo odeslat.');
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
        + Nová pozvánka
      </button>
    );
  }

  return (
    <form onSubmit={posli} className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-3 min-w-[280px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-heading font-semibold text-ink">Nová pozvánka herci</span>
        <button
          type="button"
          onClick={() => setOtevreno(false)}
          className="text-xs font-heading text-muted bg-transparent border-0 p-0 cursor-pointer"
        >
          Zavřít
        </button>
      </div>

      <p className="text-xs font-body text-muted m-0">
        Stačí e-mail. Herci přijde pozvánka do portálu a po nastavení hesla ho portál sám vyzve,
        ať doplní jméno, adresu, číslo účtu a kde může natáčet.
      </p>

      <div className="flex gap-2 flex-wrap">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoFocus
          required
          placeholder="e-mail herce"
          className="admin-input flex-1 min-w-[200px]"
        />
        <button
          type="submit"
          disabled={bezi}
          className="text-sm font-heading font-semibold rounded-lg bg-brand-purple text-white px-4 py-2 disabled:opacity-60"
        >
          {bezi ? 'Odesílám…' : 'Poslat'}
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
