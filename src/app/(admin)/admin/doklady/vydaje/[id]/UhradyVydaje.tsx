'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Currency, PaymentMethod } from '@prisma/client';
import { formatMoney, minorToInput, parseMoneyToMinor } from '@/lib/doklady';
import { nazevZpusobuUhrady, ZPUSOBY_UHRADY } from '@/lib/uctenka';
import { stavUhrady, uhrazenoMinor, zbyvaMinor } from '@/lib/expenses';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

/**
 * ÚHRADY DOKLADU NA VÍCEKRÁT (zadání 25. 9. 2026: „potřebuji u výdajů přidávat
 * částečnou úhradu, když budu třeba smlouvu nebo fakturu proplácet na
 * vícekrát, abych tam měl záznam, kolik ještě zbývá doplatit").
 *
 * Nahoře tři čísla — celkem, uhrazeno, zbývá — pod nimi jednotlivé platby a
 * řádek na zápis další. Částka se předvyplňuje tím, co zbývá: nejčastější
 * případ je doplatek, a ten se pak odklepne jedním tlačítkem.
 *
 * ZBÝVÁ SE NIKDE NEUKLÁDÁ, počítá se z rozdílu. Kdyby se částka dokladu
 * později opravila, zbytek se opraví s ní a nikde nezůstane staré číslo.
 */
export type UhradaRadek = {
  id: string;
  castkaMinor: number;
  /** ISO datum dne, kdy peníze odešly. */
  datum: string;
  zpusob: PaymentMethod;
  poznamka: string | null;
  kdoJmeno: string | null;
};

function den(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ').format(new Date(iso));
}

function dnesek(): string {
  return new Date().toISOString().slice(0, 10);
}

export function UhradyVydaje({
  expenseId,
  mena,
  celkemMinor,
  uhrady,
  paid,
  vychoziZpusob,
}: {
  expenseId: string;
  mena: Currency;
  celkemMinor: number;
  uhrady: UhradaRadek[];
  paid: boolean;
  /** Způsob z dokladu - u faktury převod, u účtenky karta. */
  vychoziZpusob: PaymentMethod;
}) {
  const router = useRouter();
  const uhrazeno = uhrazenoMinor(uhrady, celkemMinor, paid);
  const zbyva = zbyvaMinor(celkemMinor, uhrazeno);
  const stav = stavUhrady(celkemMinor, uhrazeno);

  const [castka, setCastka] = useState(() => minorToInput(zbyva > 0 ? zbyva : celkemMinor));
  const [datum, setDatum] = useState(dnesek);
  const [zpusob, setZpusob] = useState<PaymentMethod>(vychoziZpusob);
  const [poznamka, setPoznamka] = useState('');
  const [pracuji, setPracuji] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [mazu, setMazu] = useState<string | null>(null);

  const castkaMinor = parseMoneyToMinor(castka);

  async function zapis() {
    if (castkaMinor <= 0) {
      setChyba('Zadejte částku, která odešla.');
      return;
    }
    setPracuji(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/expenses/${expenseId}/uhrady`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castkaMinor, datum, zpusob, poznamka: poznamka || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Úhradu se nepodařilo zapsat.');
        return;
      }
      setPoznamka('');
      setCastka(minorToInput(Math.max(0, data?.zbyvaMinor ?? 0)));
      router.refresh();
    } catch {
      setChyba('Úhradu se nepodařilo zapsat.');
    } finally {
      setPracuji(false);
    }
  }

  async function smaz(id: string) {
    setPracuji(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/expenses/${expenseId}/uhrady/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Smazání se nezdařilo.');
        return;
      }
      setMazu(null);
      router.refresh();
    } catch {
      setChyba('Smazání se nezdařilo.');
    } finally {
      setPracuji(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">Úhrady</span>
        {stav === 'CAST' && (
          <span className="inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill bg-warnTint text-status-progress">
            Uhrazeno částečně
          </span>
        )}
      </div>

      {/* Tři čísla vedle sebe - kvůli poslednímu z nich to celé vzniklo. */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] font-heading text-muted uppercase tracking-wide m-0">Celkem</p>
          <p className="font-heading text-lg text-ink m-0 tabular-nums">{formatMoney(celkemMinor, mena)}</p>
        </div>
        <div>
          <p className="text-[11px] font-heading text-muted uppercase tracking-wide m-0">Uhrazeno</p>
          <p className="font-heading text-lg text-status-done m-0 tabular-nums">{formatMoney(uhrazeno, mena)}</p>
        </div>
        <div>
          <p className="text-[11px] font-heading text-muted uppercase tracking-wide m-0">Zbývá doplatit</p>
          <p
            className={`font-display text-xl m-0 tabular-nums ${zbyva > 0 ? 'text-danger' : 'text-status-done'}`}
          >
            {formatMoney(zbyva, mena)}
          </p>
        </div>
      </div>

      {uhrady.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col divide-y divide-line border-t border-line">
          {uhrady.map((u) => (
            <li key={u.id} className="py-2 flex items-baseline gap-3 flex-wrap">
              <span className="font-heading text-sm text-ink tabular-nums w-28 shrink-0 text-right">
                {formatMoney(u.castkaMinor, mena)}
              </span>
              <span className="text-sm font-body text-muted tabular-nums">{den(u.datum)}</span>
              <span className="text-xs font-body text-muted">{nazevZpusobuUhrady(u.zpusob)}</span>
              {u.poznamka && <span className="text-xs font-body text-ink">{u.poznamka}</span>}
              {u.kdoJmeno && <span className="text-[11px] font-body text-muted">zapsal {u.kdoJmeno}</span>}
              {/* Dvě klepnutí - smazaná úhrada se nedá vzít zpátky. */}
              <button
                type="button"
                onClick={() => (mazu === u.id ? smaz(u.id) : setMazu(u.id))}
                onBlur={() => setMazu((m) => (m === u.id ? null : m))}
                disabled={pracuji}
                className={`ml-auto text-xs font-heading rounded-lg px-2 py-1 border transition-colors disabled:opacity-60 ${
                  mazu === u.id
                    ? 'border-danger text-danger'
                    : 'border-transparent text-muted hover:text-danger hover:border-line'
                }`}
              >
                {mazu === u.id ? 'Opravdu smazat?' : 'Smazat'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}

      <div className="border-t border-line pt-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Kolik odešlo</span>
            <input
              inputMode="decimal"
              value={castka}
              onChange={(e) => setCastka(e.target.value)}
              className={`${inputClass} text-right tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Kdy</span>
            <DatumPole value={datum} onChange={(e) => setDatum(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Hrazeno</span>
            <VyberPole
              value={zpusob}
              onChange={(e) => setZpusob(e.target.value as PaymentMethod)}
              className={inputClass}
            >
              {ZPUSOBY_UHRADY.map((z) => (
                <option key={z.hodnota} value={z.hodnota}>
                  {z.nazev}
                </option>
              ))}
            </VyberPole>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Poznámka</span>
          <input
            value={poznamka}
            onChange={(e) => setPoznamka(e.target.value)}
            placeholder="např. první splátka, zbytek po dodání"
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={zapis}
            disabled={pracuji}
            className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:brightness-95 transition-all disabled:opacity-60"
          >
            {pracuji ? 'Ukládám…' : 'Zapsat úhradu'}
          </button>
          {zbyva > 0 && (
            <button
              type="button"
              onClick={() => setCastka(minorToInput(zbyva))}
              disabled={pracuji}
              className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
            >
              Doplatit zbytek ({formatMoney(zbyva, mena)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
