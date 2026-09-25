'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Currency } from '@prisma/client';
import { formatMoney } from '@/lib/doklady';
import { DatumPole } from '@/components/DatumPole';

/**
 * DODATEČNÁ FAKTURA KE SMLOUVĚ (zadání 25. 9. 2026: „my vytvoříme herci
 * smlouvu a na základě té smlouvy je platíme. Akorát někteří ještě pošlou
 * dodatečně fakturu… potřebuji, ať se počítá jeden a ať vím, že mám zaplatit
 * ten s DPH").
 *
 * Karta je jen u dokladu, který vznikl ze smlouvy. Buď se vybere faktura,
 * která už v portálu leží mezi nezařazenými (přišla na účtárnu), nebo se
 * nahraje ze svého. Tak jako tak zůstane JEDEN náklad se dvěma přílohami
 * a částka na něm je ta z faktury - s DPH.
 */
export type KandidatFaktury = { id: string; popis: string };

export function FakturaKeSmlouve({
  expenseId,
  smlouvaCislo,
  faktura,
  celkemMinor,
  bezDphMinor,
  sazba,
  mena,
  kandidati,
}: {
  expenseId: string;
  smlouvaCislo: string | null;
  faktura: { cislo: string | null; at: string } | null;
  celkemMinor: number;
  bezDphMinor: number;
  sazba: number;
  mena: Currency;
  kandidati: KandidatFaktury[];
}) {
  const router = useRouter();
  const vstup = useRef<HTMLInputElement | null>(null);
  const [zdrojId, setZdrojId] = useState('');
  const [cislo, setCislo] = useState('');
  const [castka, setCastka] = useState('');
  const [sazbaNova, setSazbaNova] = useState('21');
  const [splatnost, setSplatnost] = useState('');
  const [pracuji, setPracuji] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const zaklad = `/api/admin/expenses/${encodeURIComponent(expenseId)}/faktura-ke-smlouve`;

  async function spoj() {
    if (!zdrojId) return;
    setPracuji(true);
    setChyba(null);
    try {
      const res = await fetch(zaklad, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zdrojId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Doklady se nepodařilo spojit.');
      setZdrojId('');
      router.refresh();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Doklady se nepodařilo spojit.');
    } finally {
      setPracuji(false);
    }
  }

  async function nahraj() {
    const soubory = Array.from(vstup.current?.files ?? []);
    if (soubory.length === 0 && !cislo.trim() && !castka.trim()) {
      setChyba('Vyberte fakturu nebo vyplňte částku.');
      return;
    }
    setPracuji(true);
    setChyba(null);
    try {
      const body = new FormData();
      for (const s of soubory) body.append('soubor', s);
      body.append('cislo', cislo);
      body.append('castka', castka);
      body.append('sazba', sazbaNova);
      body.append('splatnost', splatnost);
      const res = await fetch(zaklad, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fakturu se nepodařilo připojit.');
      setCislo('');
      setCastka('');
      setSplatnost('');
      if (vstup.current) vstup.current.value = '';
      router.refresh();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Fakturu se nepodařilo připojit.');
    } finally {
      setPracuji(false);
    }
  }

  async function zrus() {
    if (!window.confirm('Odebrat značku faktury? Přílohy ani částka se nevrací.')) return;
    setPracuji(true);
    setChyba(null);
    try {
      const res = await fetch(zaklad, { method: 'DELETE' });
      if (!res.ok) throw new Error('Značku se nepodařilo zrušit.');
      router.refresh();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Značku se nepodařilo zrušit.');
    } finally {
      setPracuji(false);
    }
  }

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl text-ink m-0">Faktura ke smlouvě</h2>
        {smlouvaCislo && <span className="text-xs font-body text-muted">ze smlouvy {smlouvaCislo}</span>}
      </div>

      {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}

      {faktura ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="rounded-pill bg-tint text-brand-purple font-heading font-semibold text-xs px-3 py-1">
            Faktura {faktura.cislo || 'připojena'}
          </span>
          <span className="text-sm font-body text-ink">
            Platí se <strong>{formatMoney(celkemMinor, mena)}</strong>{' '}
            <span className="text-muted">
              ({formatMoney(bezDphMinor, mena)} bez DPH {sazba > 0 ? `+ ${sazba} %` : '· bez DPH'})
            </span>
          </span>
          <button
            type="button"
            onClick={zrus}
            disabled={pracuji}
            className="text-xs font-heading text-muted hover:text-ink bg-transparent border-0 cursor-pointer px-1"
          >
            Odebrat značku
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm font-body text-muted m-0">
            Plátce DPH pošle ke smlouvě ještě fakturu — na smlouvě je částka bez DPH, platí se ta
            z faktury. Připojte ji sem: náklad zůstane <strong>jeden</strong>, jen bude mít dvě
            přílohy a částku s DPH.
          </p>

          {kandidati.length > 0 && (
            <div className="flex items-end gap-2 flex-wrap">
              <label className="flex flex-col gap-1.5 min-w-[280px] flex-1">
                <span className="text-sm font-body text-ink">Faktura už je v portálu</span>
                <select value={zdrojId} onChange={(e) => setZdrojId(e.target.value)} className={pole}>
                  <option value="">— vyberte doklad —</option>
                  {kandidati.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.popis}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={spoj}
                disabled={pracuji || !zdrojId}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                Spojit se smlouvou
              </button>
            </div>
          )}

          <div className="border-t border-line pt-4 flex flex-col gap-3">
            <span className="text-sm font-body text-ink">…nebo fakturu nahrajte</span>
            <input
              ref={vstup}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="text-sm font-body text-muted"
            />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-body text-muted">Číslo faktury</span>
                <input value={cislo} onChange={(e) => setCislo(e.target.value)} className={pole} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-body text-muted">Částka bez DPH</span>
                <input
                  value={castka}
                  onChange={(e) => setCastka(e.target.value)}
                  inputMode="decimal"
                  className={pole}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-body text-muted">Sazba DPH</span>
                <select value={sazbaNova} onChange={(e) => setSazbaNova(e.target.value)} className={pole}>
                  <option value="21">21 %</option>
                  <option value="12">12 %</option>
                  <option value="0">bez DPH</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-body text-muted">Splatnost</span>
                <DatumPole
                  value={splatnost}
                  onChange={(e) => setSplatnost(e.target.value)}
                  className={pole}
                />
              </label>
            </div>
            <div>
              <button
                type="button"
                onClick={nahraj}
                disabled={pracuji}
                className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
              >
                {pracuji ? 'Připojuji…' : 'Připojit fakturu'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
