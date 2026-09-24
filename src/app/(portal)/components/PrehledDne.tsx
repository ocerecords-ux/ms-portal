'use client';

import { useEffect, useState } from 'react';
import { KresbaIkony } from '@/lib/ikonyTypu';
import { nactiPdfJs, nastavPdfWorker } from '@/lib/pdfJs';
import { UDALOST_PREHLED_DNE } from '@/lib/quickActions';

/**
 * OKNO S PŘEHLEDEM DNE (zadání 23. 9. 2026: „ať se mi v portálu otevře
 * průhledné vyskakovací okno a tam to bude" + „celé bych to představoval
 * lépe graficky provedené. Třeba bych použil i ikony u typů události, které
 * už máme").
 *
 * Otevře se samo, jednou za den, po prvním otevření portálu po sedmé ráno -
 * komu je přehled zapnutý v Můj účet. Data skládá server (/api/prehled-dne),
 * tady se z nich kreslí karty: čas, ikona druhu, název, druhý řádek s hercem
 * nebo účastníky a štítek studia.
 *
 * PRŮHLEDNÉ, NE ŠEDIVÉ. Pozadí zůstává vidět a rozostřené: je to zpráva na
 * dobré ráno, ne dialog, který něco blokuje. Zavře ho křížek, Escape, klik
 * mimo i tlačítko - a do dalšího rána se neukáže.
 *
 * KDYKOLIV BĚHEM DNE (zadání 24. 9. 2026: „to okno, co mě dnes čeká, bych dal
 * do toho levého panelu s rychlýma volbama, ať se tam můžu během dne jedním
 * klikem kouknout"). Rychlá volba v levém panelu pošle do portálu událost,
 * tady se na ni čeká. Takhle otevřené okno se NEPOČÍTÁ jako ranní: po zavření
 * se nikam nezapisuje, takže ráno vyskočí tak jako tak.
 */

type Druh = 'NATACENI' | 'STRIH' | 'CASTING' | 'PORADA' | 'SCHUZKA' | 'JINE';

type Udalost = {
  cas: string;
  druh: Druh;
  nazev: string;
  detail: string | null;
  studio: string | null;
  rezie: boolean;
  /** Projekt události - u první frekvence se k němu doptáme na obsah knihy. */
  projektId?: string | null;
  /** První frekvence s hercem (24. 9. 2026). */
  prvniFrekvence?: boolean;
};

type Data = {
  den: string;
  udalosti: Udalost[];
  ukoly: { text: string; cas: string | null }[];
  /** Dnes něco bylo, ale je to všechno za námi (24. 9. 2026). */
  vseZaSebou?: boolean;
};

/** Ikona a barva podle druhu - ikony jsou tytéž jako v kalendáři. */
const PODLE_DRUHU: Record<Druh, { ikona: string; barva: string; popis: string }> = {
  NATACENI: { ikona: 'mikrofon-studio', barva: '#7b55ff', popis: 'Natáčení' },
  STRIH: { ikona: 'strih', barva: '#3B82F6', popis: 'Střih' },
  CASTING: { ikona: 'casting', barva: '#EC4899', popis: 'Casting' },
  PORADA: { ikona: 'lide', barva: '#F2CB35', popis: 'Porada' },
  SCHUZKA: { ikona: 'hodiny', barva: '#14B8A6', popis: 'Schůzka' },
  JINE: { ikona: 'stitek', barva: '#A49FC0', popis: 'Blokace' },
};

const BARVA_REZIE = '#ef4444';


/**
 * O ČEM TA KNIHA JE (zadání 24. 9. 2026: „když se ta má událost v přehledu na
 * dnešek bude týkat první frekvence natáčení audioknihy, tak by mohl Bruno
 * projít text a dát mi alespoň základní info v pár větách, o čem ten příběh
 * je").
 *
 * Ukazuje se jen u PRVNÍ frekvence s hercem - tam člověk jde do studia
 * k látce, kterou nečetl. U druhé a další už ji zná a řádek navíc by jen
 * zabíral místo.
 *
 * TEXT SE ČTE TADY V PROHLÍŽEČI. Režijní edit je PDF na Disku a portál umí
 * PDF číst jen přes pdf.js (lib/pdfJs.ts). Vytáhne se z něj ukázka - začátek
 * a dva kusy z dalších míst - a ta se pošle Brunovi. Hotové shrnutí si server
 * uloží k projektu, takže tohle celé proběhne jednou za knihu; podruhé se
 * rovnou vrátí uložený text.
 */
function OCemJe({ projekt }: { projekt: string }) {
  const [text, setText] = useState<string | null>(null);
  const [stav, setStav] = useState<'nacitam' | 'ctu' | 'hotovo' | 'nic'>('nacitam');

  useEffect(() => {
    let platne = true;

    /** Ukázka z PDF: začátek knihy a dva kusy dál, ať je vidět i děj. */
    async function ukazkaZPdf(souborId: string): Promise<string | null> {
      try {
        const pdfjs = await nactiPdfJs();
        await nastavPdfWorker(pdfjs);
        const adresa = `/api/projekty/${encodeURIComponent(projekt)}/preposlech/soubor?soubor=${encodeURIComponent(souborId)}`;
        const doc = await pdfjs.getDocument({ url: adresa }).promise;
        const stran: number = doc.numPages;

        const chci = new Set<number>();
        for (let i = 1; i <= Math.min(14, stran); i++) chci.add(i);
        for (const podil of [0.4, 0.7]) {
          const od = Math.max(1, Math.round(stran * podil));
          for (let i = od; i < od + 6 && i <= stran; i++) chci.add(i);
        }

        const kusy: string[] = [];
        for (const cislo of [...chci].sort((a, b) => a - b)) {
          const strana = await doc.getPage(cislo);
          const obsah = await strana.getTextContent();
          kusy.push(
            (obsah.items as { str?: string }[])
              .map((i) => i.str ?? '')
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim(),
          );
          if (kusy.join(' ').length > 60_000) break;
        }
        await doc.destroy?.();
        const text = kusy.filter(Boolean).join('\n\n').slice(0, 60_000);
        return text.length > 500 ? text : null;
      } catch {
        return null;
      }
    }

    (async () => {
      try {
        const odpoved = await fetch(`/api/projekty/${encodeURIComponent(projekt)}/o-cem-je`);
        if (!odpoved.ok) throw new Error('nejde');
        const data = (await odpoved.json()) as { text?: string | null; textId?: string | null; nazev?: string | null };
        if (!platne) return;

        if (data.text) {
          setText(data.text);
          setStav('hotovo');
        }
        // Uložené shrnutí sedí na ten text, co je ve složce - nic dalšího.
        if (!data.textId) {
          if (!data.text) setStav('nic');
          return;
        }

        if (!data.text) setStav('ctu');
        const ukazka = await ukazkaZPdf(data.textId);
        if (!platne) return;
        if (!ukazka) {
          if (!data.text) setStav('nic');
          return;
        }

        const napsano = await fetch(`/api/projekty/${encodeURIComponent(projekt)}/o-cem-je`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ukazka, zdroj: data.nazev ?? '' }),
        });
        const vysledek = (await napsano.json().catch(() => ({}))) as { text?: string | null };
        if (!platne) return;
        if (vysledek.text) {
          setText(vysledek.text);
          setStav('hotovo');
        } else if (!data.text) {
          setStav('nic');
        }
      } catch {
        if (platne) setStav((p) => (p === 'hotovo' ? p : 'nic'));
      }
    })();

    return () => {
      platne = false;
    };
  }, [projekt]);

  if (stav === 'nic') return null;

  return (
    <div className="mt-1.5 rounded-lg border border-line bg-surface/70 px-3 py-2.5">
      <p className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted m-0 mb-1">
        První frekvence · o čem to je
      </p>
      {text ? (
        <p className="text-xs font-body text-ink m-0 whitespace-pre-line leading-relaxed">{text}</p>
      ) : (
        <p className="text-xs font-body text-muted m-0">
          {stav === 'ctu' ? 'Bruno čte rukopis…' : 'Dívám se, jestli je text k dispozici…'}
        </p>
      )}
    </div>
  );
}

export function PrehledDne() {
  const [data, setData] = useState<Data | null>(null);
  const [zavirame, setZavirame] = useState(false);
  /** Otevřel si ho člověk sám z panelu? Pak se zavření nezapisuje. */
  const [rucne, setRucne] = useState(false);

  useEffect(() => {
    let platne = true;
    // Až po načtení stránky - ať se dotaz nepere s vykreslením portálu.
    const casovac = setTimeout(() => {
      fetch('/api/prehled-dne')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (platne && d?.ukazat && typeof d.den === 'string') {
            setData({ den: d.den, udalosti: d.udalosti ?? [], ukoly: d.ukoly ?? [], vseZaSebou: d.vseZaSebou === true });
          }
        })
        .catch(() => undefined);
    }, 1200);
    return () => {
      platne = false;
      clearTimeout(casovac);
    };
  }, []);

  // Rychlá volba „Co mě dnes čeká" z levého panelu (24. 9. 2026).
  useEffect(() => {
    let platne = true;
    const naVyzadani = () => {
      fetch('/api/prehled-dne?kdykoliv=1')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!platne || !d?.ukazat || typeof d.den !== 'string') return;
          setRucne(true);
          setZavirame(false);
          setData({ den: d.den, udalosti: d.udalosti ?? [], ukoly: d.ukoly ?? [], vseZaSebou: d.vseZaSebou === true });
        })
        .catch(() => undefined);
    };
    window.addEventListener(UDALOST_PREHLED_DNE, naVyzadani);
    return () => {
      platne = false;
      window.removeEventListener(UDALOST_PREHLED_DNE, naVyzadani);
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zavri();
    };
    window.addEventListener('keydown', naKlavesu);
    return () => window.removeEventListener('keydown', naKlavesu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function zavri() {
    if (zavirame) return;
    setZavirame(true);
    setData(null);
    // Okno otevřené z panelu se nezapisuje - ranní má vyskočit tak jako tak.
    if (rucne) {
      setRucne(false);
      setZavirame(false);
      return;
    }
    // Poznámka na server, ať se dneska neotevře znovu. Když se to nepovede,
    // nic se neděje - nanejvýš okno vyskočí na jiné záložce ještě jednou.
    fetch('/api/prehled-dne', { method: 'POST' }).catch(() => undefined);
  }

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/25 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Přehled dne"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) zavri();
      }}
    >
      <div className="w-full max-w-[560px] my-auto rounded-card border border-line bg-surface/85 backdrop-blur-md shadow-lg overflow-hidden">
        {/* Hlavička - den a kolik toho je. */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-line/70">
          <div>
            <p className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted m-0">Přehled dne</p>
            <h2 className="font-display text-2xl sm:text-[28px] text-ink m-0 mt-0.5">{data.den}</h2>
          </div>
          <button
            type="button"
            onClick={zavri}
            aria-label="Zavřít"
            className="text-muted hover:text-ink text-xl leading-none mt-1"
          >
            ×
          </button>
        </div>

        <div className="px-5 sm:px-6 py-4 flex flex-col gap-4">
          {data.udalosti.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">
              {data.vseZaSebou
                ? 'Dnešek už máte za sebou — v kalendáři vás dnes nic dalšího nečeká.'
                : 'V kalendáři dnes nic vašeho nemám.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.udalosti.map((u, i) => {
                const vzhled = PODLE_DRUHU[u.druh] ?? PODLE_DRUHU.JINE;
                const barva = u.rezie ? BARVA_REZIE : vzhled.barva;
                return (
                  <div key={`${u.cas}-${i}`}>
                  <div
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                    style={{ borderColor: `${barva}55`, backgroundColor: `${barva}14` }}
                  >
                    <span
                      className="shrink-0 grid place-items-center w-9 h-9 rounded-pill"
                      style={{ backgroundColor: `${barva}26`, color: barva }}
                      title={u.rezie ? `${vzhled.popis} · režie na dálku` : vzhled.popis}
                    >
                      <KresbaIkony klic={u.rezie ? 'rezie-na-dalku' : vzhled.ikona} velikost={18} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-heading font-semibold text-sm text-ink tabular-nums">{u.cas}</span>
                        <span className="font-heading text-sm text-ink truncate">{u.nazev}</span>
                      </span>
                      {(u.detail || u.rezie) && (
                        <span className="block text-xs font-body text-muted truncate">
                          {u.detail}
                          {u.detail && u.rezie ? ' · ' : ''}
                          {u.rezie ? 'režie na dálku' : ''}
                        </span>
                      )}
                    </span>

                    {u.studio && (
                      <span className="shrink-0 rounded-pill border border-line px-2 py-0.5 text-[11px] font-heading text-muted">
                        {u.studio}
                      </span>
                    )}
                  </div>

                  {/* Briefing před první frekvencí (24. 9. 2026). */}
                  {u.prvniFrekvence && u.projektId && <OCemJe projekt={u.projektId} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Úkoly jen na dnešek (23. 9. 2026) - dlouhodobé sem nepatří. */}
          {data.ukoly.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted m-0">Úkoly na dnešek</p>
              {data.ukoly.map((u, i) => (
                <div key={`${u.text}-${i}`} className="flex items-center gap-2.5">
                  <span className="shrink-0 w-4 h-4 rounded-[5px] border border-line" aria-hidden />
                  <span className="text-sm font-body text-ink truncate">{u.text}</span>
                  {u.cas && <span className="text-xs font-heading text-muted tabular-nums">{u.cas}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 sm:px-6 pb-5">
          <button
            type="button"
            onClick={zavri}
            className="rounded-pill bg-brand-purple text-white font-heading text-sm px-5 py-2"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
