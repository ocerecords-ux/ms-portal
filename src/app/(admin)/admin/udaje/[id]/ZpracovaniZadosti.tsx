'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RozdilPole } from '@/lib/pozvankaUdaju';

/**
 * Co se s vyplněnou žádostí dá udělat (zadání 16. 9. 2026).
 *
 * ODKLIKÁVAJÍ SE JEN PŘEPISY. Doplnění prázdného pole je zaškrtnuté a nejde
 * odškrtnout — o to tady nikdo nepřemýšlí, prázdné pole nemá co ztratit.
 * Přepis toho, co už vyplněné bylo, je naopak zaškrtnutý, ale jde vypnout:
 * číslo účtu je přesně to, u čeho se vyplatí kouknout dvakrát.
 */
export function ZpracovaniZadosti({
  id,
  stav,
  token,
  email,
  vyplneno,
  rozdily,
}: {
  id: string;
  stav: string;
  token: string;
  email: string | null;
  vyplneno: string | null;
  rozdily: RozdilPole[];
}) {
  const router = useRouter();
  const [vybrane, setVybrane] = useState<string[]>(rozdily.map((r) => r.klic));
  const [bezi, setBezi] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [kam, setKam] = useState(email ?? '');

  const odkaz = typeof window === 'undefined' ? '' : `${window.location.origin}/udaje/${token}`;

  async function akce(telo: Record<string, unknown>, hotovaZprava: string) {
    setBezi(true);
    setChyba(null);
    setZprava(null);
    try {
      const res = await fetch(`/api/admin/pozvanky-udaju/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Nepodařilo se to.');
        return;
      }
      setZprava(hotovaZprava);
      router.refresh();
    } catch {
      setChyba('Nepodařilo se to.');
    } finally {
      setBezi(false);
    }
  }

  async function zrus() {
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/pozvanky-udaju/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setChyba('Zrušení se nepodařilo.');
        return;
      }
      setZprava('Odkaz přestal platit.');
      router.refresh();
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {stav === 'CEKA' && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
          <p className="font-heading font-semibold text-ink m-0">Čeká se na vyplnění</p>
          <div className="flex gap-2 items-center flex-wrap">
            <input readOnly value={odkaz} className="admin-input flex-1 min-w-[220px] text-xs" />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(odkaz).then(
                  () => setZprava('Odkaz je ve schránce.'),
                  () => setZprava('Zkopírujte odkaz ručně.'),
                );
              }}
              className="text-sm font-heading font-semibold rounded-lg border border-line px-3 py-2 hover:border-brand-purple"
            >
              Zkopírovat
            </button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              value={kam}
              onChange={(e) => setKam(e.target.value)}
              type="email"
              placeholder="E-mail"
              className="admin-input flex-1 min-w-[200px]"
            />
            <button
              type="button"
              disabled={bezi}
              onClick={() => void akce({ akce: 'poslat', ...(kam ? { email: kam } : {}) }, 'Odkaz odešel.')}
              className="text-sm font-heading font-semibold rounded-lg border border-brand-purple text-brand-purple px-4 py-2 disabled:opacity-60"
            >
              Poslat e-mailem
            </button>
          </div>
        </div>
      )}

      {stav === 'VYPLNENA' && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <div>
            <p className="font-heading font-semibold text-ink m-0">Co se má zapsat</p>
            <p className="text-xs font-body text-muted m-0 mt-1">
              {vyplneno
                ? `Vyplněno ${new Date(vyplneno).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}.`
                : ''}{' '}
              Zaškrtnuté se zapíše do portálu, odškrtnuté zůstane, jak je.
            </p>
          </div>

          {rozdily.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">
              Nic se neliší od toho, co už v portálu je. Není co zapisovat.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {rozdily.map((r) => (
                <li key={r.klic} className="flex items-start gap-3 border-b border-line pb-2 last:border-0">
                  <input
                    type="checkbox"
                    checked={vybrane.includes(r.klic)}
                    onChange={(e) =>
                      setVybrane((p) => (e.target.checked ? [...p, r.klic] : p.filter((k) => k !== r.klic)))
                    }
                    className="mt-1 w-4 h-4 accent-brand-purple"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-heading font-semibold text-ink">
                      {r.popisek}
                      {!r.doplneni && (
                        <span className="ml-2 text-xs font-body text-brand-purple">přepisuje</span>
                      )}
                    </span>
                    <span className="block text-sm font-body text-ink break-words">{r.nove}</span>
                    {!r.doplneni && (
                      <span className="block text-xs font-body text-muted break-words">
                        teď: {r.ted}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={bezi || rozdily.length === 0}
              onClick={() => void akce({ akce: 'zapsat', klice: vybrane }, 'Zapsáno do portálu.')}
              className="text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-5 py-2.5 disabled:opacity-60"
            >
              {bezi ? 'Zapisuji…' : 'Zapsat do portálu'}
            </button>
            <button
              type="button"
              disabled={bezi}
              onClick={() => void akce({ akce: 'zapsat', klice: [] }, 'Odloženo — nic se nezapsalo.')}
              className="text-sm font-heading font-semibold rounded-pill border border-line text-muted px-5 py-2.5 hover:border-brand-purple disabled:opacity-60"
            >
              Nezapisovat nic
            </button>
          </div>
        </div>
      )}

      {stav === 'HOTOVA' && (
        <div className="bg-okTint border border-brand-green rounded-card p-5">
          <p className="font-heading font-semibold text-brand-greenDeep m-0">Údaje jsou v portálu</p>
          <p className="text-sm font-body text-ink m-0 mt-1">
            Odkaz už nejde použít znovu. Když bude potřeba něco doplnit, založte novou žádost.
          </p>
        </div>
      )}

      {stav === 'ZRUSENA' && (
        <div className="bg-field border border-line rounded-card p-5">
          <p className="font-heading font-semibold text-ink m-0">Zrušeno</p>
          <p className="text-sm font-body text-muted m-0 mt-1">Odkaz už neplatí.</p>
        </div>
      )}

      {zprava && <p className="text-sm font-body text-muted m-0">{zprava}</p>}
      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}

      {(stav === 'CEKA' || stav === 'VYPLNENA') && (
        <button
          type="button"
          disabled={bezi}
          onClick={() => void zrus()}
          className="self-start text-sm font-heading text-muted hover:text-danger bg-transparent border-0 p-0 cursor-pointer disabled:opacity-60"
        >
          Zrušit žádost
        </button>
      )}
    </div>
  );
}
