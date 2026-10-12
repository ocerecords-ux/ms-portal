'use client';

import { useState } from 'react';
import { usePreklad } from '../components/JazykProvider';
import type { TerminKlienta } from '@/lib/terminyKlientaServer';

/**
 * NATÁČECÍ PLÁN V PŘEHLEDU KLIENTA (zadání 30. 9. 2026: „potřebuji udělat,
 * aby klienti viděli všechny natáčecí frekvence s hercem").
 *
 * ROZBALUJE SE DO TABULKY, NE PŘES NI (upřesnění 1. 10. 2026: „chci, aby se
 * posunul další projekt, který je pod tím, dolů a udělalo se mezi nimi místo
 * a tam se to zobrazí").
 *
 * Do té doby se karta kreslila napevno usazená (`position: fixed`) nad
 * tabulkou - a protože tlačítko je širší než svůj sloupec, překrývalo se to
 * se sousedním válcem progresu. Takový přehled je k ničemu, i kdyby data
 * seděla.
 *
 * Teď je to prosté: tlačítko jen přepíná, a seznam termínů vykreslí tabulka
 * jako SAMOSTATNÝ ŘÁDEK pod tím projektem (viz ProjectsTable v shared.tsx).
 * Řádek zabere místo, další projekt se posune dolů a nic se nepřekrývá.
 */

export function TlacitkoTerminu({
  terminy,
  otevreno,
  onPrepnout,
}: {
  terminy: TerminKlienta[];
  otevreno: boolean;
  onPrepnout: () => void;
}) {
  const t = usePreklad();
  if (terminy.length === 0) {
    return <span className="text-muted text-sm">—</span>;
  }

  /**
   * KOLIK UŽ SE USKUTEČNILO (30. 9. 2026: „u těch přehledů termínů
   * v natáčecím plánu by bylo dobré nějak vidět, které frekvence se už
   * uskutečnily"). Je to i na tlačítku, aby se kvůli tomu nemuselo rozbalovat.
   */
  const odtoceno = terminy.filter((x) => x.odtoceno).length;

  return (
    <button
      type="button"
      onClick={onPrepnout}
      aria-expanded={otevreno}
      title={t('terminy.napoveda')}
      /**
       * Tlačítko se do sloupce vejde celé (1. 10. 2026). Dřív neslo celé
       * „Zobrazit termíny" a bylo širší než svůj sloupec, takže z buňky
       * vylezlo přes progres; pak se zkracovalo třemi tečkami na „Zo…", což
       * nebyl popisek, ale hádanka. Teď je text krátký a sloupec se mu
       * přizpůsobí (tabulka má `table-auto`).
       */
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-surface px-2.5 py-1 text-xs font-heading text-ink cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors"
    >
      {/*
        Krátký popisek (1. 10. 2026: „u toho natáčecího plánu to můžeme
        zkrátit na Zobrazit a Skrýt"). Co se zobrazuje, říká hlavička
        sloupce - opakovat to na tlačítku jen bralo místo.
      */}
      <span>{otevreno ? t('terminy.skrytKratce') : t('terminy.zobrazitKratce')}</span>
      <span className="shrink-0 tabular-nums text-muted">
        {odtoceno > 0 ? `${odtoceno}/${terminy.length}` : terminy.length}
      </span>
      <span aria-hidden className={`shrink-0 text-[9px] transition-transform ${otevreno ? 'rotate-180' : ''}`}>
        ▼
      </span>
    </button>
  );
}

/** Rozbalený seznam termínů - vykresluje se ve vlastním řádku pod projektem. */
export function SeznamTerminu({ terminy: vychozi }: { terminy: TerminKlienta[] }) {
  const t = usePreklad();
  /**
   * REŽIE KLIENTA SE ZAŠKRTÁVÁ ROVNOU TADY (zadání 12. 10. 2026). Stav si
   * seznam drží u sebe a na server posílá jen tu jednu změnu - celá stránka
   * se kvůli zaškrtnutí nenačítá znovu.
   */
  const [terminy, setTerminy] = useState<TerminKlienta[]>(vychozi);
  const [uklada, setUklada] = useState<string | null>(null);
  const pristi = terminy.find((x) => !x.odtoceno) ?? null;
  const odtoceno = terminy.filter((x) => x.odtoceno).length;
  /** Jméno toho, kdo za klienta režíruje - u firmy bez nastavení prázdné. */
  const reziser = terminy.find((x) => x.rezieKlientaJmeno)?.rezieKlientaJmeno ?? null;

  async function prepniRezii(x: TerminKlienta) {
    if (!x.muzuOznacit || uklada) return;
    const prijde = !x.rezieKlienta;
    setUklada(x.id);
    // Zaškrtne se hned, ať to nedrhne; když server odmítne, vrátí se zpět.
    setTerminy((s) => s.map((y) => (y.id === x.id ? { ...y, rezieKlienta: prijde } : y)));
    const res = await fetch('/api/terminy/rezie-klienta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: x.id, prijde }),
    }).catch(() => null);
    if (!res?.ok) {
      setTerminy((s) => s.map((y) => (y.id === x.id ? { ...y, rezieKlienta: !prijde } : y)));
    }
    setUklada(null);
  }

  return (
    // `max-w`: seznam se nemá roztahovat přes celou tabulku, jinak mezi
    // datem a studiem zůstane půl obrazovky prázdna (1. 10. 2026).
    <div className="flex max-w-2xl flex-col gap-2 rounded-card border border-line bg-field/40 p-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
          {t('terminy.nadpis')}
        </span>
        <span className="text-[11px] font-body text-muted">
          {odtoceno === terminy.length
            ? t('terminy.vseOdtoceno')
            : t('terminy.souhrn', { odtoceno, celkem: terminy.length })}
        </span>
      </div>

      {/* REŽIE KLIENTA (12. 10. 2026) - jedna věta, ať je jasné, co ta
          zaškrtávátka u termínů znamenají. První frekvence je zaškrtnutá sama. */}
      {reziser && (
        <p className="m-0 text-[11px] font-body text-muted">
          {terminy.some((x) => x.muzuOznacit)
            ? t('terminy.reziePopisMohu', { jmeno: reziser })
            : t('terminy.reziePopis', { jmeno: reziser })}
        </p>
      )}

      {/*
        Prostě seznam, jeden termín na řádek (1. 10. 2026: „a ten seznam
        frekvencí bych dal pod sebe. Prostě seznam"). Dva sloupce vedle sebe
        se četly hůř než delší sloupec pod sebou.
      */}
      <ul className="list-none p-0 m-0 flex flex-col gap-1">
        {terminy.map((x) => (
          <li
            key={x.id}
            className={`flex items-baseline gap-x-3 gap-y-1 flex-wrap rounded-lg px-2 py-1.5 ${
              x.odtoceno ? 'text-muted' : 'bg-surface text-ink'
            } ${pristi && x.id === pristi.id ? 'border border-brand-purple/40' : ''}`}
          >
            <span className="font-heading text-sm tabular-nums whitespace-nowrap">
              {kdy(x.start, x.end)}
            </span>
            {x.herec && <span className="text-xs font-body">{x.herec}</span>}
            <span className="text-[11px] font-body text-muted">{x.studio}</span>
            {/* „Přijdu režírovat" (12. 10. 2026). Kdo na to nemá právo, vidí
                jen značku u termínů, na které režie klienta přijde. */}
            {x.rezieKlientaJmeno &&
              (x.muzuOznacit ? (
                <label className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-heading cursor-pointer">
                  <input
                    type="checkbox"
                    checked={x.rezieKlienta}
                    disabled={uklada === x.id}
                    onChange={() => prepniRezii(x)}
                  />
                  <span className={x.rezieKlienta ? 'text-brand-purple' : 'text-muted'}>
                    {t('terminy.reziePrijdu')}
                  </span>
                </label>
              ) : (
                x.rezieKlienta && (
                  <span className="shrink-0 text-[11px] font-heading text-brand-purple">
                    {t('terminy.rezieJmeno', { jmeno: x.rezieKlientaJmeno })}
                  </span>
                )
              ))}
            {/*
              KDE SE TEN DEN SKONČILO (1. 10. 2026: „bylo by super, kdyby byly
              zaznačeny strany v pdf, na které se v ten den skončilo").
              Strana ze zápisu zvukaře. U budoucích termínů tam nic není -
              prázdné místo je lepší než nula, která by vypadala jako údaj.
            */}
            {x.stranaDo != null && (
              <span
                title={t('terminy.stranyNapoveda')}
                className="shrink-0 text-[11px] font-heading tabular-nums text-ink"
              >
                {x.stranaOd != null
                  ? t('terminy.stranyRozsah', { od: x.stranaOd, do: x.stranaDo })
                  : t('terminy.stranyDo', { strana: x.stranaDo })}
              </span>
            )}
            {x.odtoceno ? (
              <span
                title={t('terminy.odtoceno')}
                className="shrink-0 text-[11px] font-heading text-status-done"
              >
                ✓ {t('terminy.odtoceno')}
              </span>
            ) : (
              pristi &&
              x.id === pristi.id && (
                <span className="shrink-0 text-[11px] font-heading text-brand-purple">
                  {t('terminy.nejblizsi')}
                </span>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** „út 7. 10. · 10:00–13:00" - v pásmu toho, kdo se dívá. */
function kdy(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const den = new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(s);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${den} · ${cas(s)}–${cas(e)}`;
}
