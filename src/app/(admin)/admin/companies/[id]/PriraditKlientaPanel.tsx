'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * KONTAKTNÍ OSOBA KE VŠEM ZAKÁZKÁM FIRMY (zadání 24. 9. 2026: „potřebuju
 * u všech projektů, které se týkají Nakladatelství Jota, přiřadit klienta
 * Danu Nekvindovou, aby se jí propsaly do portálu dokončené projekty. Ale
 * potichu, bez notifikací").
 *
 * Doplnit kontakt na padesáti hotových zakázkách po jedné je hodina klikání
 * a padesát zápisů do historie. Tohle projde projekty firmy jedním dotazem
 * a nikomu nic nepošle.
 *
 * PTÁ SE PODRUHÉ. Přiřazením se člověku v portálu otevřou zakázky, které
 * do té doby neviděl - to není překlep, který se odmázne.
 */
export function PriraditKlientaPanel({
  companyId,
  ucty,
}: {
  companyId: string;
  /** Klientské účty té firmy - jen mezi nimi se vybírá. */
  ucty: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [kdo, setKdo] = useState('');
  const [prepsat, setPrepsat] = useState(false);
  const [ptaSe, setPtaSe] = useState(false);
  const [bezi, setBezi] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  if (ucty.length === 0) return null;

  async function prirad() {
    if (bezi || !kdo) return;
    setBezi(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/prirad-klienta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klientUserId: kdo, prepsat }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Přiřazení se nepodařilo.');
        return;
      }
      const pocet = Number(data?.pocet ?? 0);
      setHlaska(
        pocet === 0
          ? 'Nebylo co měnit — všechny zakázky už kontakt mají.'
          : `Hotovo: ${pocet} ${pocet === 1 ? 'zakázka' : pocet < 5 ? 'zakázky' : 'zakázek'} teď vede ${data?.jmeno ?? 'vybraný kontakt'}.`,
      );
      setPtaSe(false);
      router.refresh();
    } catch {
      setChyba('Přiřazení se nepodařilo.');
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div>
        <h3 className="font-heading font-semibold text-sm text-ink m-0">Přiřadit kontakt ke všem zakázkám firmy</h3>
        <p className="text-xs font-body text-muted m-0 mt-1">
          Vybraný člověk uvidí zakázky firmy ve svých Projektech včetně dokončených. Proběhne to
          potichu — nikomu nechodí zpráva ani zvonek a do historie projektu se nic nepíše.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={kdo}
          onChange={(e) => {
            setKdo(e.target.value);
            setPtaSe(false);
          }}
          className="bg-field border border-line rounded-lg px-3 py-2 text-sm font-heading text-ink"
        >
          <option value="">Vyberte kontaktní osobu…</option>
          {ucty.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prepsat}
            onChange={(e) => {
              setPrepsat(e.target.checked);
              setPtaSe(false);
            }}
            className="w-4 h-4 accent-brand-purple"
          />
          <span className="text-xs font-body text-ink">
            přepsat i tam, kde už někdo je
            <span className="block text-muted">bez zaškrtnutí se doplní jen zakázky bez kontaktu</span>
          </span>
        </label>

        <button
          type="button"
          disabled={!kdo || bezi}
          onClick={() => {
            if (!ptaSe) {
              setPtaSe(true);
              return;
            }
            void prirad();
          }}
          className={`text-sm font-heading font-semibold rounded-pill px-5 py-2.5 disabled:opacity-50 ${
            ptaSe ? 'bg-brand-purple text-white' : 'bg-bar text-white'
          }`}
        >
          {bezi ? 'Přiřazuji…' : ptaSe ? 'Opravdu? Klepněte znovu' : 'Přiřadit'}
        </button>
      </div>

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
      {hlaska && <p className="text-sm font-body text-brand-greenDeep m-0">{hlaska}</p>}
    </div>
  );
}
