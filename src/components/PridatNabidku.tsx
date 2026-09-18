'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NavrhNabidky } from '@/lib/nabidkaZObjednavky';
import { formatMoney } from '@/lib/doklady';

/**
 * PŘEDVYPLNĚNÁ NABÍDKA Z OBJEDNÁVKY (zadání 18. 9. 2026: „aby tam zůstala
 * někde nabídnutá a předvyplněná. Nějakým tlačítkem ji přidá. Třeba: Přidat
 * nabídku").
 *
 * Panel jen UKAZUJE, co by v nabídce bylo. Doklad vzniká až klepnutím na
 * tlačítko, a to obyčejnou cestou přes POST /api/admin/offers - stejně jako
 * když ho někdo vyplní ručně. Nabídka tak dostane číslo z číselné řady až ve
 * chvíli, kdy ji někdo doopravdy chce; kdyby se zakládala sama s příchodem
 * objednávky, přibývaly by v Dokladech doklady, které nikdo neviděl, a v řadě
 * by byly díry po těch smazaných.
 *
 * Po založení se rovnou otevře nabídka: je to ROZPRACOVANÝ doklad, ne
 * odeslaný - cenu i položku jde ještě upravit a odesílá se zvlášť. Kdyby to
 * tlačítko rovnou posílalo klientovi, byl by to jeden klik od ceny, kterou
 * nikdo nezkontroloval.
 */
export function PridatNabidku({
  navrh,
  caflouProjectId,
}: {
  navrh: NavrhNabidky;
  caflouProjectId: string;
}) {
  const router = useRouter();
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function pridej() {
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerCompanyId: navrh.issuerCompanyId,
          companyId: navrh.companyId,
          caflouProjectId,
          subject: navrh.predmet,
          currency: navrh.currency,
          items: [
            {
              description: navrh.predmet,
              quantity: 1,
              unit: 'ks',
              unitPriceMinor: navrh.castkaMinor,
              vatRate: 21,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Nabídku se nepodařilo založit.');
        setBezi(false);
        return;
      }
      // Rovnou do nabidky - at se da zkontrolovat a odeslat.
      router.push(`/admin/doklady/nabidky/${data.id}`);
      router.refresh();
    } catch {
      setChyba('Nabídku se nepodařilo založit.');
      setBezi(false);
    }
  }

  const objednano = new Intl.DateTimeFormat('cs-CZ').format(new Date(navrh.objednanoAt));

  return (
    <div className="rounded-card border border-brand-purple/40 bg-tint px-4 py-3.5 flex flex-col gap-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <span className="block font-heading font-semibold text-sm text-ink">
            Nabídka je připravená
          </span>
          <span className="block text-xs font-body text-muted mt-0.5">
            Z objednávky z webu ({objednano}). Zatím nikde není — vznikne až tímhle tlačítkem
            a bude rozpracovaná, takže ji ještě stihnete upravit.
          </span>
        </div>
        <button
          type="button"
          onClick={() => void pridej()}
          disabled={bezi}
          className="shrink-0 font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {bezi ? 'Zakládám…' : 'Přidat nabídku'}
        </button>
      </div>

      {/* Co v ni bude - at se neklika naslepo. */}
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 m-0 text-xs font-body">
        <div className="flex gap-2 min-w-0">
          <dt className="text-muted shrink-0">Předmět</dt>
          <dd className="m-0 text-ink truncate">{navrh.predmet}</dd>
        </div>
        <div className="flex gap-2 min-w-0">
          <dt className="text-muted shrink-0">Odběratel</dt>
          <dd className="m-0 text-ink truncate">{navrh.companyName || '—'}</dd>
        </div>
        <div className="flex gap-2 min-w-0">
          <dt className="text-muted shrink-0">Vystaví</dt>
          <dd className="m-0 text-ink truncate">{navrh.issuerName}</dd>
        </div>
        <div className="flex gap-2 min-w-0">
          <dt className="text-muted shrink-0">Cena bez DPH</dt>
          <dd className="m-0 text-ink font-heading font-semibold">
            {formatMoney(navrh.castkaMinor, navrh.currency)}
            {navrh.pageCount ? (
              <span className="font-body font-normal text-muted"> · {navrh.pageCount} NS</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}
    </div>
  );
}
