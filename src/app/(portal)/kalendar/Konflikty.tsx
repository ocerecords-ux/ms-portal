'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DNU_KONFLIKTU, rozsahKonfliktu } from '@/lib/konflikty';
import { kodJazyka, type Jazyk } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * ZNAK KONFLIKTŮ V KALENDÁŘI (zadání 23. 9. 2026: „měl by se objevit nějaký
 * znak u kalendářů, na který když kliknu, tak se dozvím, kde je konflikt").
 *
 * Štítek stojí vedle kalendářů a svítí jen tehdy, KDYŽ JE CO ŘEŠIT. Po
 * kliknutí se rozbalí seznam: co s čím se pere, v kolik a který den; klik na
 * řádek skočí v kalendáři na ten den.
 *
 * DVA ODDÍLY: „Moje" jsou dvě věci naráz u mě (casting a schůzka), „Natáčení"
 * je dvakrát obsazené studio nebo herec či zvukař na dvou místech. Natáčení
 * se ukazuje jen tam, KDE JE ČLOVĚK OZNAČENÝ (upřesnění 23. 9. 2026: „mě
 * nezajímají konflikty v natáčení. Jen tam, kde jsem označený").
 *
 * Počítá se to na serveru pro zobrazený rozsah - viz /api/kalendar/konflikty.
 *
 * ZÁMĚR SE ODKLEPNE (zadání 24. 9. 2026: „měl bych mít možnost někdy zrušit
 * daný konflikt v kalendáři, někdy to může být záměr"). Tlačítko „Je to
 * záměr" konflikt schová - pro všechny a i z kolečka v liště. Dole v panelu
 * zůstane výpis odklepnutých, ať jde kterýkoliv vrátit. Jakmile se některá
 * z těch dvou událostí posune, upozornění se vrátí samo: schvaluje se
 * konkrétní překryv, ne dvojice událostí navždy.
 */

type Konflikt = {
  id: string;
  klic: string;
  druh: 'MOJE' | 'PROVOZ';
  den: string;
  cas: string;
  duvod: string;
  udalosti: { cas: string; popis: string }[];
};

type Skryty = { klic: string; druh: string; popis: string; kdo: string; kdy: string };

const BARVA = '#f97316';

/** Den konfliktu slovy („po 28. 9."). Jazyk se podává parametrem. */
function datumDne(jazyk: Jazyk, den: string): string {
  const [y, m, d] = den.split('-').map(Number);
  return new Intl.DateTimeFormat(kodJazyka(jazyk), {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function Konflikty({
  naDen,
}: {
  /** Skok na den konfliktu. */
  naDen: (den: string) => void;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  /**
   * STEJNÝ ÚSEK JAKO KOLEČKO V LIŠTĚ (oprava 24. 9. 2026: „proč mu tam svítí
   * ta tečka u kalendáře, když tam nic není").
   *
   * Do teď se panel ptal na to, co bylo zrovna v kalendáři vidět - kdo měl
   * otevřený dnešek a konflikt až za týden, viděl svítit tečku a po
   * rozkliknutí prázdno. Teď se obojí ptá na čtrnáct dní dopředu, takže co
   * svítí, je i v seznamu; na den konfliktu se skočí klepnutím na řádek.
   */
  const { od, doKdy } = useMemo(() => {
    const r = rozsahKonfliktu();
    return { od: r.od.toISOString(), doKdy: r.doKdy.toISOString() };
  }, []);
  const [moje, setMoje] = useState<Konflikt[]>([]);
  const [provoz, setProvoz] = useState<Konflikt[]>([]);
  const [skryte, setSkryte] = useState<Skryty[]>([]);
  const [otevreno, setOtevreno] = useState(false);
  const [pracuje, setPracuje] = useState<string | null>(null);

  const nacti = useCallback(() => {
    return fetch(`/api/kalendar/konflikty?od=${encodeURIComponent(od)}&do=${encodeURIComponent(doKdy)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setMoje(Array.isArray(d.moje) ? d.moje : []);
        setProvoz(Array.isArray(d.provoz) ? d.provoz : []);
        setSkryte(Array.isArray(d.skryte) ? d.skryte : []);
      })
      .catch(() => undefined);
  }, [od, doKdy]);

  useEffect(() => {
    void nacti();
  }, [nacti]);

  /** „Je to záměr" - konflikt zmizí i z kolečka v liště. */
  async function skryj(k: Konflikt) {
    if (pracuje) return;
    setPracuje(k.klic);
    try {
      await fetch('/api/kalendar/konflikty/skryt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          klic: k.klic,
          druh: k.druh,
          // Popis se ukládá na server a čte ho pak i někdo jiný, proto se
          // datum píše česky - důvod (`duvod`) chodí z API taky česky.
          popis: `${datumDne('cs', k.den)} ${k.cas} · ${k.duvod}`,
          duvod: k.duvod,
        }),
      });
      await nacti();
    } finally {
      setPracuje(null);
    }
  }

  /** Vrátit odklepnutý konflikt zpátky mezi upozornění. */
  async function vrat(klic: string) {
    if (pracuje) return;
    setPracuje(klic);
    try {
      await fetch(`/api/kalendar/konflikty/skryt?klic=${encodeURIComponent(klic)}`, {
        method: 'DELETE',
      });
      await nacti();
    } finally {
      setPracuje(null);
    }
  }

  const celkem = moje.length + provoz.length;
  // Když je všechno odklepnuté jako záměr, značka zůstane - jen zešedne.
  // Jinak by nebylo kudy zpátky: seznam odklepnutých je uvnitř panelu.
  if (celkem === 0 && skryte.length === 0) return null;
  const vseOdklepnute = celkem === 0;

  const datum = (den: string) => datumDne(jazyk, den);

  const radky = (seznam: Konflikt[]) =>
    seznam.map((k) => (
      <span key={k.id} className="rounded-lg border border-line bg-paper flex flex-col">
        <button
          type="button"
          onClick={() => {
            naDen(k.den);
            setOtevreno(false);
          }}
          className="text-left hover:bg-field rounded-t-lg px-3 pt-2 pb-1.5 flex flex-col gap-1 w-full"
        >
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-heading font-semibold text-xs text-ink">{datum(k.den)}</span>
            <span className="font-heading text-xs tabular-nums" style={{ color: BARVA }}>
              {k.cas}
            </span>
            <span className="text-xs font-body text-muted">{k.duvod}</span>
          </span>
          {k.udalosti.map((u, i) => (
            <span key={i} className="text-xs font-body text-muted pl-0.5">
              • {u.cas} — {u.popis}
            </span>
          ))}
        </button>
        {/* „Je to záměr" - odklepnutý překryv zmizí i z kolečka v liště. */}
        <button
          type="button"
          onClick={() => void skryj(k)}
          disabled={pracuje === k.klic}
          title={t('konflikty.jeToZamerBublina')}
          className="self-end text-[11px] font-heading text-muted hover:text-ink px-3 pb-1.5 disabled:opacity-50"
        >
          {pracuje === k.klic ? t('obecne.ukladam') : t('konflikty.jeToZamer')}
        </button>
      </span>
    ));

  return (
    <span className="relative inline-flex shrink-0">
      {/* JEN IKONA (zadání 23. 9. 2026: „dej tam jen ikony"). Číslo zůstává
          jako malý odznak v rohu - bez něj by nebylo poznat, jestli je konflikt
          jeden, nebo patnáct. */}
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        aria-expanded={otevreno}
        aria-label={
          vseOdklepnute
            ? t('konflikty.popisekZadne', { pocet: skryte.length })
            : t('konflikty.popisekPocet', { pocet: celkem })
        }
        title={
          vseOdklepnute
            ? t('konflikty.bublinaZadne', { pocet: skryte.length })
            : t('konflikty.bublinaPocet', { pocet: celkem })
        }
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
          vseOdklepnute ? 'border-line text-muted hover:text-ink' : ''
        }`}
        style={
          vseOdklepnute ? undefined : { borderColor: BARVA, backgroundColor: `${BARVA}1f`, color: BARVA }
        }
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3.5 22 20H2z" />
          <path d="M12 10v4M12 17.2v.1" />
        </svg>
        {!vseOdklepnute && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-pill grid place-items-center text-[10px] font-heading font-semibold text-white tabular-nums"
            style={{ backgroundColor: BARVA }}
          >
            {celkem > 99 ? '99+' : celkem}
          </span>
        )}
      </button>

      {otevreno && (
        <span className="absolute left-0 top-full mt-2 z-40 w-[min(92vw,420px)] max-h-[60vh] overflow-y-auto rounded-card border border-line bg-surface shadow-lg p-3 flex flex-col gap-3">
          <span className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted">
            {t('konflikty.nejblizsichDni', { pocet: DNU_KONFLIKTU })}
          </span>
          {moje.length > 0 && (
            <span className="flex flex-col gap-1.5">
              <span className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted">
                {t('konflikty.nadpisMoje', { pocet: moje.length })}
              </span>
              {radky(moje)}
            </span>
          )}
          {provoz.length > 0 && (
            <span className="flex flex-col gap-1.5">
              <span className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted">
                {t('konflikty.nadpisProvoz', { pocet: provoz.length })}
              </span>
              {radky(provoz)}
            </span>
          )}
          {skryte.length > 0 && (
            <span className="flex flex-col gap-1.5 border-t border-line pt-2.5">
              <span className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted">
                {t('konflikty.nadpisOdklepnute', { pocet: skryte.length })}
              </span>
              {skryte.map((z) => (
                <span
                  key={z.klic}
                  className="flex items-center gap-2 flex-wrap text-xs font-body text-muted"
                >
                  <span className="min-w-0 flex-1">
                    {z.popis}
                    <span className="block text-[11px]">{z.kdo}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void vrat(z.klic)}
                    disabled={pracuje === z.klic}
                    className="text-[11px] font-heading text-brand-purple hover:underline disabled:opacity-50"
                  >
                    {pracuje === z.klic ? t('konflikty.vracim') : t('konflikty.vratit')}
                  </button>
                </span>
              ))}
            </span>
          )}
          <span className="text-[11px] font-body text-muted">{t('konflikty.vysvetleni')}</span>
        </span>
      )}
    </span>
  );
}
