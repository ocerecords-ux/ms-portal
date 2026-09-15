'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MAX_DELKA_TEXTU, MAX_PRILOH, type PodobnaPripominka } from '@/lib/pripominky';

/** Co z připomínky ukazuje panel v liště. */
type PripominkaVPanelu = {
  id: string;
  text: string;
  autor: string;
  odkud: string | null;
  pridalSe: number;
  prilohy: { id: string; url: string; nazev: string }[];
};

/**
 * Zpětná vazba k portálu (zadání 15. 9. 2026: „potřeboval bych vymyslet
 * nějakou zpětnou vazbu k portálu … uživatelé by to psali jako jednotlivé
 * položky s možností, že by mohli přiložit i printscreeny").
 *
 * PROČ V HORNÍ LIŠTĚ: připomínka se člověku vybaví přesně ve chvíli, kdy na
 * tu věc kouká. Kdyby se kvůli ní muselo někam odklikat, devět z deseti jich
 * nikdo nenapíše. Tlačítko je proto na každé stránce a s připomínkou se
 * automaticky odešle i adresa, kde člověk zrovna byl - bez toho se půlka
 * připomínek nedohledá.
 *
 * PRINTSCREEN JDE VLOŽIT PŘES Ctrl+V. Lidi mačkají PrintScreen a pak hledají,
 * kam obrázek uložit; tady stačí vložit ho rovnou do políčka.
 *
 * UPOZORNĚNÍ NA DUPLICITU: jakmile je napsaná věta, portál se zeptá serveru,
 * jestli něco podobného už neleží v seznamu, a nabídne připojení k tomu
 * místo založení další položky.
 *
 * ŽŮŽO-LABŮŽO TU MÁ ROVNOU CELÝ SEZNAM (zadání 15. 9. 2026: „když se na tu
 * ikonu zpětné vazby prokliknu já ze svého profilu, tak se mi ukáže přehled
 * všech připomínek"). Odškrtává se přímo v panelu - kvůli třem hotovým věcem
 * není proč chodit do Mého účtu.
 */
export function ZpetnaVazba({
  odznak = 0,
  spravce = false,
  interni = false,
}: {
  odznak?: number;
  spravce?: boolean;
  /**
   * Je to někdo z Mediaspace? Tým ví, komu připomínky chodí, a je pro něj
   * praktické to vidět; klientovi ani herci se jméno neuvádí (zadání
   * 15. 9. 2026: „u zbytku - klientů, herců to nech obecně za nás").
   */
  interni?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  const [text, setText] = useState('');
  const [obrazky, setObrazky] = useState<{ soubor: File; nahled: string }[]>([]);
  const [podobne, setPodobne] = useState<PodobnaPripominka[]>([]);
  const [pripojitK, setPripojitK] = useState<string | null>(null);
  const [odesila, setOdesila] = useState(false);
  const [hotovo, setHotovo] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  // Seznam pro Zuzo-labuzo. Nacita se az pri otevreni panelu - na kazde
  // strance portalu by to byl dotaz navic pro nic.
  const [seznam, setSeznam] = useState<PripominkaVPanelu[] | null>(null);
  const [pise, setPise] = useState(false);
  const [pracuje, setPracuje] = useState<string | null>(null);
  const souborRef = useRef<HTMLInputElement>(null);
  const tlacitkoRef = useRef<HTMLButtonElement>(null);
  // Panel se kresli na PEVNE pozici u praveho okraje okna, ne pod tlacitkem.
  // Bublina sedi uprostred ovladacich prvku, takze v uzkem okne by panel
  // zakotveny na jeji pravou hranu vylezl vlevo z obrazovky (zkouska
  // 15. 9. 2026 - chybel zacatek kazdeho radku).
  const [shora, setShora] = useState(64);

  useLayoutEffect(() => {
    if (!otevreno) return;
    const misto = tlacitkoRef.current?.getBoundingClientRect();
    if (misto) setShora(misto.bottom + 8);
  }, [otevreno]);

  // Seznam vsech pripominek - jen pro spravce a jen kdyz je panel otevreny.
  useEffect(() => {
    if (!otevreno || !spravce) return;
    fetch('/api/pripominky?vse=1')
      .then((r) => r.json())
      .then((d) => setSeznam(d?.otevrene ?? []))
      .catch(() => setSeznam([]));
  }, [otevreno, spravce]);

  async function odskrtni(id: string) {
    setPracuje(id);
    try {
      await fetch(`/api/pripominky/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotovo: true }),
      });
      setSeznam((s) => (s ? s.filter((p) => p.id !== id) : s));
      router.refresh();
    } finally {
      setPracuje(null);
    }
  }

  // Hlídání duplicit - se zpožděním, ať se neptáme po každém písmenu.
  useEffect(() => {
    if (!otevreno || text.trim().length < 12) {
      setPodobne([]);
      return;
    }
    const casovac = setTimeout(() => {
      fetch(`/api/pripominky?podobne=${encodeURIComponent(text.trim())}`)
        .then((r) => r.json())
        .then((d) => setPodobne(d?.podobne ?? []))
        .catch(() => setPodobne([]));
    }, 600);
    return () => clearTimeout(casovac);
  }, [text, otevreno]);

  function pridejSoubory(soubory: File[]) {
    const obrazkyJen = soubory.filter((f) => f.type.startsWith('image/'));
    if (obrazkyJen.length === 0) return;
    setObrazky((s) => [...s, ...obrazkyJen.map((f) => ({ soubor: f, nahled: URL.createObjectURL(f) }))].slice(0, MAX_PRILOH));
  }

  function zavri() {
    setOtevreno(false);
    setChyba(null);
    setHotovo(false);
    setPripojitK(null);
    setPise(false);
  }

  async function odesli() {
    if (!text.trim()) {
      setChyba('Napište prosím, co se má opravit.');
      return;
    }
    setOdesila(true);
    setChyba(null);
    try {
      const data = new FormData();
      data.set('text', text.trim());
      data.set('odkud', pathname ?? '');
      if (pripojitK) data.set('podobnaId', pripojitK);
      obrazky.forEach((o) => data.append('prilohy', o.soubor, o.soubor.name || 'printscreen.png'));

      const res = await fetch('/api/pripominky', { method: 'POST', body: data });
      const odpoved = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(odpoved?.error || 'Připomínku se nepodařilo uložit.');
        return;
      }
      setHotovo(true);
      setText('');
      setObrazky([]);
      setPodobne([]);
      setPripojitK(null);
      setTimeout(zavri, 1800);
    } catch {
      setChyba('Připomínku se nepodařilo uložit.');
    } finally {
      setOdesila(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={tlacitkoRef}
        type="button"
        onClick={() => (otevreno ? zavri() : setOtevreno(true))}
        title="Připomínka k portálu"
        aria-label="Připomínka k portálu"
        className="relative w-9 h-9 rounded-full grid place-items-center text-brand-green hover:bg-white/15 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5L5.5 20v-4H6a2 2 0 0 1-2-2z" />
          <path d="M8.5 9.5h7M8.5 12.5h4" />
        </svg>
        {/* Kolik pripominek ceka na Zuzo-labuzo. Ostatni zadny odznak nemaji -
            svoje pripominky vidi ve svem uctu. */}
        {odznak > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-pill bg-brand-green text-[10px] font-semibold text-[#0F2A18] tabular-nums grid place-items-center">
            {odznak > 99 ? '99+' : odznak}
          </span>
        )}
      </button>

      {otevreno && (
        <div
          style={{ top: shora }}
          className="fixed right-3 sm:right-6 w-[420px] max-w-[calc(100vw-24px)] bg-surface border border-line rounded-card shadow-lg p-4 z-50 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-heading font-semibold text-sm text-ink m-0">
                {spravce && !pise ? 'Připomínky k portálu' : 'Připomínka k portálu'}
              </h3>
              <p className="text-xs font-body text-muted m-0 mt-0.5">
                {spravce && !pise
                  ? 'Co lidem v portálu vadí. Odškrtnutá položka jim zmizí.'
                  : `Co nefunguje, co chybí, co by šlo líp. Jde to rovnou ${interni ? 'Ondřejovi' : 'nám'}.`}
              </p>
            </div>
            <button type="button" onClick={zavri} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
              ×
            </button>
          </div>

          {spravce && !pise && !hotovo ? (
            <>
              <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-2 -mx-1 px-1">
                {seznam === null ? (
                  <p className="text-sm font-body text-muted m-0 py-2">Načítám…</p>
                ) : seznam.length === 0 ? (
                  <p className="text-sm font-body text-muted m-0 py-2">
                    Nic nečeká. Lidem se portál zatím líbí.
                  </p>
                ) : (
                  seznam.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-lg border border-line bg-field/60 px-3 py-2.5 flex gap-2.5 ${
                        pracuje === p.id ? 'opacity-60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => odskrtni(p.id)}
                        disabled={pracuje === p.id}
                        title="Odškrtnout"
                        className="mt-0.5 w-4 h-4 shrink-0 accent-brand-green cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-body text-ink m-0">{p.text}</p>
                        <p className="text-[11px] font-body text-muted m-0 mt-1 flex flex-wrap gap-x-3">
                          <span>{p.autor}</span>
                          {p.odkud && <span>{p.odkud}</span>}
                          {p.pridalSe > 0 && (
                            <span className="text-brand-purpleDark">+{p.pridalSe} hlásí totéž</span>
                          )}
                        </p>
                        {p.prilohy.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {p.prilohy.map((o) => (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                key={o.id}
                                src={o.url}
                                alt={o.nazev}
                                className="w-10 h-10 object-cover rounded border border-line"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setPise(true)}
                  className="text-xs font-heading text-brand-purpleDark hover:underline"
                >
                  + Napsat připomínku
                </button>
                <a href="/muj-ucet" className="text-xs font-heading text-muted hover:text-ink">
                  Celý seznam v Mém účtu
                </a>
              </div>
            </>
          ) : hotovo ? (
            <p className="text-sm font-body text-status-done bg-okTint border border-line rounded-lg px-3 py-3 m-0">
              Díky! Připomínka je v seznamu.
            </p>
          ) : (
            <>
              <textarea
                autoFocus
                value={text}
                maxLength={MAX_DELKA_TEXTU}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => {
                  const soubory = Array.from(e.clipboardData.files);
                  if (soubory.length) {
                    e.preventDefault();
                    pridejSoubory(soubory);
                  }
                }}
                rows={4}
                placeholder={'Např. „Ve výkazech nejde vybrat projekt, když má dlouhý název.“ Printscreen můžete vložit rovnou přes Ctrl+V.'}
                className="w-full rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple resize-y"
              />

              {podobne.length > 0 && (
                <div className="rounded-lg border border-line bg-tint px-3 py-2.5 flex flex-col gap-2">
                  <p className="text-xs font-heading font-semibold text-ink m-0">Tohle už někdo hlásil:</p>
                  {podobne.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-xs font-body text-ink">
                      <input
                        type="checkbox"
                        checked={pripojitK === p.id}
                        onChange={(e) => setPripojitK(e.target.checked ? p.id : null)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block">„{p.text.length > 120 ? `${p.text.slice(0, 120)}…` : p.text}"</span>
                        <span className="text-muted">
                          {p.autor} · shoda {Math.round(p.shoda * 100)} % — zaškrtnutím se připojíte k téhle
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {obrazky.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {obrazky.map((o, i) => (
                    <span key={`${o.nahled}-${i}`} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.nahled} alt="" className="w-16 h-16 object-cover rounded-lg border border-line" />
                      <button
                        type="button"
                        onClick={() => setObrazky((s) => s.filter((_, j) => j !== i))}
                        aria-label="Odebrat obrázek"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-line text-xs leading-none text-muted hover:text-danger"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {chyba && <p className="text-xs text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => souborRef.current?.click()}
                  disabled={obrazky.length >= MAX_PRILOH}
                  className="text-xs font-heading text-brand-purpleDark hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  + Printscreen
                </button>
                <input
                  ref={souborRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    pridejSoubory(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={odesli}
                  disabled={odesila || !text.trim()}
                  className="bg-brand-green text-onAccent font-heading font-semibold text-xs rounded-pill px-4 py-2 disabled:opacity-60"
                >
                  {odesila ? 'Odesílám…' : pripojitK ? 'Připojit se' : 'Odeslat'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
