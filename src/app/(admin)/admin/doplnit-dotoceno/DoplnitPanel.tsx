'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nazevStavu } from '@/lib/stavyProjektu';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

export type ProjektKDoplneni = {
  caflouProjectId: string;
  nazev: string;
  firma: string | null;
  stav: string;
  herci: { id: string; jmeno: string; dotoceno: boolean }[];
};

/**
 * Stavy, ze kterých se stav překlopí - musí sedět s PREKLOPENI
 * v dotoceniStavServer.ts.
 *
 * ZŮSTÁVÁ ČESKY SCHVÁLNĚ: stavy projektů leží v databázi česky (dávka 7e),
 * takže se podle nich porovnává i ukládá. Na obrazovku jdou přes
 * `nazevStavu(…, jazyk)`, který je přeloží podle kódu.
 */
const PREKLOPI_SE: Record<string, string> = {
  'Natáčíme': 'Dotočeno',
  'Natáčíme/stříháme': 'Dotočeno/stříháme',
};

/**
 * Výběr herců k doplnění + soupis před zápisem.
 *
 * NAPŘED SOUPIS, POTOM ZÁPIS. Zaškrtnutí samo nic neukládá; druhá obrazovka
 * vypíše, co přesně se zapíše a kterým projektům se přehodí stav. U hromadné
 * opravy ostrých dat je tenhle mezikrok rozdíl mezi překlepem a průšvihem -
 * zpátky to nevrátí nikdo, protože se u toho záměrně nic neodesílá a nikdo
 * si toho tedy nevšimne.
 */
export function DoplnitPanel({ projekty }: { projekty: ProjektKDoplneni[] }) {
  const router = useRouter();
  const jazyk = useJazyk();
  const t = usePreklad();
  const [vybrano, setVybrano] = useState<Record<string, Set<string>>>({});
  const [soupis, setSoupis] = useState(false);
  const [ukladam, setUkladam] = useState(false);
  const [hotovo, setHotovo] = useState<{ hercu: number; stavu: number } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  function prepni(projektId: string, userId: string) {
    setVybrano((s) => {
      const dalsi = { ...s };
      const mnozina = new Set(dalsi[projektId] ?? []);
      if (mnozina.has(userId)) mnozina.delete(userId);
      else mnozina.add(userId);
      if (mnozina.size === 0) delete dalsi[projektId];
      else dalsi[projektId] = mnozina;
      return dalsi;
    });
  }

  /** Co se zapíše - a u kterých projektů z toho vyjde i překlopení stavu. */
  const davka = useMemo(() => {
    return projekty
      .filter((p) => vybrano[p.caflouProjectId]?.size)
      .map((p) => {
        const ids = vybrano[p.caflouProjectId]!;
        // Stav se prekloni, az kdyz maji fajfku VSICHNI herci projektu -
        // stejne pravidlo jako v dotoceniStavServer.ts.
        const vsichni = p.herci.every((h) => h.dotoceno || ids.has(h.id));
        return {
          projekt: p,
          herci: p.herci.filter((h) => ids.has(h.id)),
          novyStav: vsichni ? (PREKLOPI_SE[p.stav] ?? null) : null,
        };
      });
  }, [projekty, vybrano]);

  const hercuCelkem = davka.reduce((n, d) => n + d.herci.length, 0);

  async function zapis() {
    setUkladam(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/doplnit-dotoceno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projekty: davka.map((d) => ({
            caflouProjectId: d.projekt.caflouProjectId,
            userIds: d.herci.map((h) => h.id),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || t('doplnit.nejdeUlozit'));
        return;
      }
      setHotovo({ hercu: (data as { hercu: number }).hercu, stavu: (data as { stavu: number }).stavu });
      setVybrano({});
      setSoupis(false);
      router.refresh();
    } catch {
      setChyba(t('doplnit.nejdeUlozit'));
    } finally {
      setUkladam(false);
    }
  }

  if (projekty.length === 0) {
    return (
      <p className="text-sm font-body text-muted m-0">
        {t('doplnit.neniCo')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hotovo && (
        <p className="text-sm font-heading text-status-done bg-okTint rounded-lg px-4 py-3 m-0">
          {t(hotovo.hercu === 1 ? 'doplnit.zapsanoJeden' : 'doplnit.zapsanoVic', {
            pocet: hotovo.hercu,
          })}
          {hotovo.stavu > 0 && t('doplnit.prehozenStav', { pocet: hotovo.stavu })}
          {t('doplnit.zadnaZprava')}
        </p>
      )}
      {chyba && (
        <p className="text-sm font-heading text-danger bg-dangerTint rounded-lg px-4 py-3 m-0">{chyba}</p>
      )}

      {soupis ? (
        <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('doplnit.zapiseSe')}
          </h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            {davka.map((d) => (
              <li key={d.projekt.caflouProjectId} className="flex flex-col gap-0.5">
                <span className="text-sm font-heading font-semibold text-ink">{d.projekt.nazev}</span>
                <span className="text-xs font-body text-muted">
                  {d.herci.map((h) => h.jmeno).join(', ')}
                  {d.novyStav ? (
                    <>
                      {t('doplnit.stavPred')}
                      <span className="text-ink font-heading">
                        {nazevStavu(d.projekt.stav, jazyk)} → {nazevStavu(d.novyStav, jazyk)}
                      </span>
                    </>
                  ) : (
                    t('doplnit.stavZustava')
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={ukladam}
              onClick={() => void zapis()}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2.5 disabled:opacity-60"
            >
              {ukladam ? t('doplnit.zapisuji') : t('doplnit.zapsatBezZprav')}
            </button>
            <button
              type="button"
              disabled={ukladam}
              onClick={() => setSoupis(false)}
              className="text-sm font-heading font-semibold text-muted hover:text-ink"
            >
              {t('doplnit.zpetKVyberu')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            disabled={hercuCelkem === 0}
            onClick={() => setSoupis(true)}
            className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2.5 disabled:opacity-40"
          >
            {hercuCelkem > 0
              ? t('doplnit.ukazatPocet', { pocet: hercuCelkem })
              : t('doplnit.ukazat')}
          </button>
          <span className="text-xs font-body text-muted">{t('doplnit.nicSeNeulozi')}</span>
        </div>
      )}

      <div className="bg-surface rounded-card border border-line shadow-sm divide-y divide-line">
        {projekty.map((p) => (
          <div key={p.caflouProjectId} className="p-4 flex flex-col gap-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-heading font-semibold text-ink">{p.nazev}</span>
              {p.firma && <span className="text-xs font-body text-muted">{p.firma}</span>}
              <span className="text-xs font-heading text-muted">
                · {nazevStavu(p.stav, jazyk) || t('doplnit.bezStavu')}
              </span>
              {PREKLOPI_SE[p.stav] && (
                <span className="text-[11px] font-heading text-brand-purple">
                  {t('doplnit.preklopiSe', { stav: nazevStavu(PREKLOPI_SE[p.stav], jazyk) })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.herci.map((h) => (
                <label
                  key={h.id}
                  className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-heading ${
                    h.dotoceno
                      ? 'border-brand-green text-muted cursor-default'
                      : 'border-line text-ink cursor-pointer hover:border-brand-purple'
                  }`}
                >
                  <input
                    type="checkbox"
                    // Kdo uz fajfku ma, je jen k videni: prepsat by se tim
                    // datum dotoceni na dnesek a skutecne datum by se ztratilo.
                    disabled={h.dotoceno}
                    checked={h.dotoceno || (vybrano[p.caflouProjectId]?.has(h.id) ?? false)}
                    onChange={() => prepni(p.caflouProjectId, h.id)}
                    className="accent-brand-purple"
                  />
                  {h.jmeno}
                  {h.dotoceno && <span className="text-xs">{t('doplnit.uzMa')}</span>}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
