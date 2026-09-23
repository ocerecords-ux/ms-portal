'use client';

import { useState } from 'react';
import { OrderForm } from './OrderForm';
import { AdOrderForm } from './AdOrderForm';
import type { NarratorOption } from './NarratorMultiSelect';

/**
 * Klient, ktery poptava OBOJI (audioknihy i reklamy - zadani 12. 9. 2026),
 * si tu prepina, jaky typ objednavky prave zaklada. Klient jen s jednim
 * druhem zakazek tenhle prepinac vubec nevidi - viz objednavka/page.tsx.
 */
export function OrderTypeSwitcher({
  ratePerPage,
  cenuUrcujeKlient = false,
  herci,
  uvodZaver = false,
}: {
  ratePerPage: number;
  /** Cenu navrhuje klient (23. 9. 2026) - viz OrderForm. */
  cenuUrcujeKlient?: boolean;
  herci: NarratorOption[];
  uvodZaver?: boolean;
}) {
  const [tab, setTab] = useState<'audiokniha' | 'reklama'>('audiokniha');

  return (
    <div className="flex flex-col gap-5 items-center">
      <div className="flex items-center gap-2 bg-surface border border-line rounded-pill p-1">
        <button
          type="button"
          onClick={() => setTab('audiokniha')}
          className={`px-4 py-1.5 rounded-pill text-sm font-heading font-medium transition-colors ${
            tab === 'audiokniha' ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
          }`}
        >
          Audiokniha
        </button>
        <button
          type="button"
          onClick={() => setTab('reklama')}
          className={`px-4 py-1.5 rounded-pill text-sm font-heading font-medium transition-colors ${
            tab === 'reklama' ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
          }`}
        >
          Reklama
        </button>
      </div>

      <div className="w-full">{tab === 'audiokniha' ? <OrderForm ratePerPage={ratePerPage} cenuUrcujeKlient={cenuUrcujeKlient} herci={herci} uvodZaver={uvodZaver} /> : <AdOrderForm />}</div>
    </div>
  );
}
