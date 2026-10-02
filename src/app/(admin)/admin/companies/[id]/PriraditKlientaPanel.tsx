'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

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
  const t = usePreklad();
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
        setChyba(data?.error || t('firma.prirazeniNepodarilo'));
        return;
      }
      const pocet = Number(data?.pocet ?? 0);
      const celkem = Number(data?.celkem ?? 0);
      // Tri tvary cisla v cestine, dva v anglictine - kazdy tvar je vlastni
      // klic a vybira ho tohle (stejne jako klicOdpoctu v ProjectMetaForm).
      const zakazek = (n: number) =>
        t(n === 1 ? 'firma.zakazkaJedna' : n < 5 ? 'firma.zakazkyMalo' : 'firma.zakazekMnoho', { n });
      setHlaska(
        celkem === 0
          ? t('firma.zadnaZakazka')
          : pocet === 0
            ? t('firma.nebyloCoMenit', { pocet: zakazek(celkem) })
            : t('firma.prirazenoHotovo', {
                pocet: zakazek(pocet),
                celkem,
                jmeno: data?.jmeno ?? t('firma.vybranyKontakt'),
              }),
      );
      setPtaSe(false);
      router.refresh();
    } catch {
      setChyba(t('firma.prirazeniNepodarilo'));
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div>
        <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('firma.priraditKontakt')}</h3>
        <p className="text-xs font-body text-muted m-0 mt-1">{t('firma.priraditKontaktPopis')}</p>
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
          <option value="">{t('firma.vyberteKontakt')}</option>
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
            {t('firma.prepsatIKde')}
            <span className="block text-muted">{t('firma.prepsatIKdePopis')}</span>
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
          {bezi ? t('firma.prirazuji') : ptaSe ? t('firma.opravduKlepnete') : t('firma.priradit')}
        </button>
      </div>

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
      {hlaska && <p className="text-sm font-body text-brand-greenDeep m-0">{hlaska}</p>}
    </div>
  );
}
