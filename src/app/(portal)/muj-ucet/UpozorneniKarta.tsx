'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Co má klientovi z portálu chodit — v jeho profilu (zadání 16. 9. 2026:
 * „klienti by měli mít možnost si to pak zapnout v portálu individuálně").
 *
 * Nastavuje se to i na kartě uživatele v administraci, ale tam to zapíná
 * někdo od nás. Tady si to klient přepne sám, a hlavně sám vypne — upozornění,
 * které se dá zrušit jedině telefonátem do studia, se čte jako spam.
 *
 * Ukládá se hned při přepnutí, bez tlačítka: je to jediný přepínač a čekání
 * na „Uložit" by u něj byl jen krok navíc.
 */
export function UpozorneniKarta({ initial }: { initial: { dotoceno: boolean } }) {
  const router = useRouter();
  const [dotoceno, setDotoceno] = useState(initial.dotoceno);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uloz(hodnota: boolean) {
    // Prepinac se posune hned, at to nedrha. Kdyz ulozeni selze, vrati se
    // zpatky - jinak by na obrazovce zustal stav, ktery nikde neplati.
    setDotoceno(hodnota);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/me/upozorneni', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dostavaDotocenoKlient: hodnota }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Uložení se nezdařilo.');
        setDotoceno(!hodnota);
        return;
      }
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
      setDotoceno(!hodnota);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-ink m-0">Upozornění</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">Co vám má portál hlásit.</p>
      </div>

      <label className="flex items-start gap-2 text-sm font-heading text-ink">
        <input
          type="checkbox"
          checked={dotoceno}
          disabled={saving}
          onChange={(e) => void uloz(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Chci vědět, když dotočíme s hercem
          <br />
          <span className="text-xs font-body text-muted">
            Mail a zvoneček v portálu pokaždé, když ve studiu skončíme s hercem na některém
            z vašich projektů.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-danger m-0">{error}</p>}
    </div>
  );
}
