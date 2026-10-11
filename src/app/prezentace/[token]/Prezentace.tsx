'use client';

import { useState } from 'react';
import type { PrezentaceProKlienta } from '@/lib/prezentaceServer';
import { Prehravac } from './Prehravac';

/**
 * CO KLIENT VIDÍ (zadání 11. 10. 2026). Pořadí je přesně to zadané:
 * projekt a klient → naše reference → návrh řešení → nabídka herců →
 * cenová nabídka → podmínky spolupráce.
 *
 * JEDNA DLOUHÁ STRÁNKA, ŽÁDNÉ ZÁLOŽKY. Klient ji často otevře na telefonu
 * mezi dvěma schůzkami; záložky by znamenaly, že půlku nabídky nenajde.
 * Sekce jsou očíslované, takže je v jednom scrollu poznat, kolik ještě zbývá.
 *
 * SCHVÁLENÍ JE PO RUCE PO CELOU DOBU. Lišta dole jde s klientem; kdyby bylo
 * tlačítko jen na konci, musel by se k němu po rozmyšlení proscrollovat zpět.
 */
export type Cenik = {
  cislo: string;
  predmet: string | null;
  platiDo: string | null;
  polozky: { popis: string; mnozstvi: number; jednotka: string | null; cena: string }[];
  bezDph: string;
  dph: string;
  celkem: string;
  sleva: string | null;
  slevaPopis: string | null;
};

export function Prezentace({
  token,
  data,
  cenik,
}: {
  token: string;
  data: PrezentaceProKlienta;
  cenik: Cenik | null;
}) {
  const [hraje, setHraje] = useState<string | null>(null);
  const [vybrany, setVybrany] = useState<string | null>(data.vybranyHerecId);
  const [schvaleno, setSchvaleno] = useState<string | null>(data.schvalenoAt);
  const [jmeno, setJmeno] = useState(data.schvalilJmeno ?? '');
  const [ptaSeNaJmeno, setPtaSeNaJmeno] = useState(false);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function posli(telo: Record<string, unknown>): Promise<boolean> {
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/prezentace/${encodeURIComponent(token)}/odpoved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setChyba(d.error || 'Nepovedlo se to odeslat. Zkuste to prosím znovu.');
        return false;
      }
      return true;
    } catch {
      setChyba('Nepovedlo se to odeslat. Zkuste to prosím znovu.');
      return false;
    } finally {
      setPracuje(false);
    }
  }

  async function vyberHlas(id: string) {
    const novy = vybrany === id ? null : id;
    setVybrany(novy);
    await posli({ akce: 'herec', herecId: novy ?? '' });
  }

  async function schval() {
    if (!(await posli({ akce: 'schvalit', jmeno: jmeno.trim() || undefined }))) return;
    setSchvaleno(new Date().toISOString());
    setPtaSeNaJmeno(false);
  }

  /** Sekce se číslují podle toho, které jsou vyplněné - ne napevno. */
  const sekce: { klic: string; nazev: string }[] = [
    data.reference.length > 0 ? { klic: 'reference', nazev: 'Naše reference' } : null,
    data.navrhReseni?.trim() ? { klic: 'navrh', nazev: 'Návrh řešení' } : null,
    data.herci.length > 0 ? { klic: 'herci', nazev: 'Nabídka hlasů' } : null,
    cenik ? { klic: 'cena', nazev: 'Cenová nabídka' } : null,
    data.podminky?.trim() ? { klic: 'podminky', nazev: 'Podmínky spolupráce' } : null,
  ].filter(Boolean) as { klic: string; nazev: string }[];

  const cislo = (klic: string) => sekce.findIndex((s) => s.klic === klic) + 1;

  return (
    <main className="min-h-screen bg-paper">
      {/* HLAVIČKA. Velká, s logem a jménem klienta - první obrazovka má říct
          „tohle je pro vás a od nás", ne začínat tabulkou. */}
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-purple via-brand-purpleDeep to-brand-purpleDark">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 pt-8 pb-14 sm:pt-10 sm:pb-20 flex flex-col gap-8">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-11 sm:h-14 w-auto" />
          </div>

          <div className="flex flex-col gap-3">
            <span className="inline-flex self-start items-center gap-2 rounded-pill bg-white/15 text-white font-heading font-semibold text-[11px] uppercase tracking-wider px-3 py-1">
              Cenová nabídka
            </span>
            <h1 className="font-display text-4xl sm:text-6xl text-white m-0 leading-[1.05]">
              {data.nadpis}
            </h1>
            {data.klientNazev && (
              <p className="font-heading text-white/80 text-lg sm:text-xl m-0">
                pro {data.klientNazev}
              </p>
            )}
            {data.podtitul?.trim() && (
              <p className="font-body text-white/75 text-base sm:text-lg m-0 max-w-[60ch] whitespace-pre-wrap">
                {data.podtitul}
              </p>
            )}
          </div>

          {/* Co je uvnitř - ať klient hned ví, jak dlouhá nabídka ho čeká. */}
          {sekce.length > 0 && (
            <nav className="flex items-center gap-2 flex-wrap">
              {sekce.map((s, i) => (
                <a
                  key={s.klic}
                  href={`#${s.klic}`}
                  className="rounded-pill border border-white/25 text-white/90 font-heading font-semibold text-xs px-3 py-1.5 no-underline hover:bg-white/10 transition-colors"
                >
                  <span className="text-brand-green">{i + 1}</span> {s.nazev}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>
      <div className="h-1 bg-brand-green" aria-hidden="true" />

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-12 sm:py-16 flex flex-col gap-14 sm:gap-20 pb-40">
        {data.reference.length > 0 && (
          <Sekce id="reference" cislo={cislo('reference')} nazev="Naše reference" popis="Poslechněte si, co jsme dělali jinde.">
            <div className="flex flex-col gap-3">
              {data.reference.map((u) => (
                <Karta key={u.id}>
                  <Prehravac ukazka={u} hraje={hraje === u.id} onHraje={() => setHraje(u.id)} />
                </Karta>
              ))}
            </div>
          </Sekce>
        )}

        {data.navrhReseni?.trim() && (
          <Sekce id="navrh" cislo={cislo('navrh')} nazev="Návrh řešení">
            <Proza text={data.navrhReseni} />
          </Sekce>
        )}

        {data.herci.length > 0 && (
          <Sekce
            id="herci"
            cislo={cislo('herci')}
            nazev="Nabídka hlasů"
            popis={
              data.lzeSchvalit
                ? 'Poslechněte si je a klepněte na ten, který vám sedí — rovnou se nám to ozve.'
                : 'Poslechněte si je a dejte nám vědět, který vám sedí.'
            }
          >
            <div className="flex flex-col gap-3">
              {data.herci.map((u) => (
                <Karta key={u.id} zvyrazneno={vybrany === u.id}>
                  <Prehravac ukazka={u} hraje={hraje === u.id} onHraje={() => setHraje(u.id)} />
                  {data.lzeSchvalit && (
                    <button
                      type="button"
                      onClick={() => void vyberHlas(u.id)}
                      disabled={pracuje}
                      className={`mt-3 rounded-pill font-heading font-semibold text-xs px-4 py-2 cursor-pointer border transition-colors disabled:opacity-50 ${
                        vybrany === u.id
                          ? 'bg-brand-green text-black border-transparent'
                          : 'bg-surface text-ink border-line hover:border-brand-purple'
                      }`}
                    >
                      {vybrany === u.id ? '✓ Tenhle hlas chceme' : 'Vybrat tenhle hlas'}
                    </button>
                  )}
                </Karta>
              ))}
            </div>
          </Sekce>
        )}

        {cenik && (
          <Sekce
            id="cena"
            cislo={cislo('cena')}
            nazev="Cenová nabídka"
            popis={cenik.predmet || undefined}
          >
            <div className="rounded-card border border-line bg-surface overflow-hidden">
              <ul className="list-none m-0 p-0">
                {cenik.polozky.map((p, i) => (
                  <li
                    key={`${p.popis}-${i}`}
                    className="flex items-baseline gap-4 px-4 sm:px-6 py-3.5 border-b border-line last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-ink text-sm sm:text-base m-0">{p.popis}</p>
                      {(p.mnozstvi !== 1 || p.jednotka) && (
                        <p className="font-body text-xs text-muted m-0 mt-0.5 tabular-nums">
                          {p.mnozstvi}
                          {p.jednotka ? ` ${p.jednotka}` : ''}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-heading font-semibold text-ink text-sm sm:text-base tabular-nums">
                      {p.cena}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="bg-field px-4 sm:px-6 py-4 flex flex-col gap-1.5">
                {cenik.sleva && (
                  <Radek
                    popisek={cenik.slevaPopis || 'Sleva'}
                    hodnota={`− ${cenik.sleva}`}
                    zelena
                  />
                )}
                <Radek popisek="Bez DPH" hodnota={cenik.bezDph} />
                <Radek popisek="DPH" hodnota={cenik.dph} />
                <div className="h-px bg-line my-1" />
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-heading font-semibold text-ink text-base">Celkem s DPH</span>
                  <span className="font-display text-2xl sm:text-3xl text-ink tabular-nums">
                    {cenik.celkem}
                  </span>
                </div>
              </div>
            </div>

            <p className="font-body text-xs text-muted m-0 mt-2">
              Nabídka č. {cenik.cislo}
              {cenik.platiDo && ` · platí do ${new Date(cenik.platiDo).toLocaleDateString('cs-CZ')}`}
            </p>
          </Sekce>
        )}

        {data.podminky?.trim() && (
          <Sekce id="podminky" cislo={cislo('podminky')} nazev="Podmínky spolupráce">
            <Proza text={data.podminky} />
          </Sekce>
        )}

        {/* KDO JE POD NABÍDKOU. První věc, kterou klient hledá, když chce
            něco doladit - ne obecná adresa, ale konkrétní člověk. */}
        {data.manazer?.jmeno && (
          <div className="rounded-card border border-line bg-surface p-5 sm:p-6 flex flex-col gap-1">
            <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
              Vaše kontaktní osoba
            </span>
            <p className="font-heading font-semibold text-ink text-lg m-0">{data.manazer.jmeno}</p>
            <div className="flex items-center gap-4 flex-wrap font-body text-sm">
              {data.manazer.email && (
                <a href={`mailto:${data.manazer.email}`} className="text-brand-purple no-underline hover:underline">
                  {data.manazer.email}
                </a>
              )}
              {data.manazer.telefon && (
                <a href={`tel:${data.manazer.telefon}`} className="text-brand-purple no-underline hover:underline">
                  {data.manazer.telefon}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LIŠTA SE SCHVÁLENÍM. Drží se dole po celou dobu čtení. */}
      {data.lzeSchvalit && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-line bg-surface/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-6 sm:px-10 py-3 flex items-center gap-3 flex-wrap">
            {schvaleno ? (
              <p className="m-0 font-heading font-semibold text-sm text-brand-greenDeep">
                ✓ Nabídku jste schválili{jmeno.trim() ? ` — děkujeme, ${jmeno.trim()}` : ', děkujeme'}. Ozveme se vám s termíny.
              </p>
            ) : ptaSeNaJmeno ? (
              <>
                <input
                  value={jmeno}
                  autoFocus
                  onChange={(e) => setJmeno(e.target.value)}
                  placeholder="Vaše jméno"
                  className="min-w-0 flex-1 max-w-xs rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
                />
                <button
                  type="button"
                  onClick={() => void schval()}
                  disabled={pracuje}
                  className="rounded-pill bg-brand-green text-black font-heading font-semibold text-sm px-5 py-2.5 border-0 cursor-pointer disabled:opacity-50"
                >
                  Potvrdit schválení
                </button>
                <button
                  type="button"
                  onClick={() => setPtaSeNaJmeno(false)}
                  className="rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-sm px-4 py-2 cursor-pointer"
                >
                  Zpět
                </button>
              </>
            ) : (
              <>
                <span className="font-body text-sm text-muted">
                  Sedí vám to? Schvalte to rovnou tady.
                </span>
                <button
                  type="button"
                  onClick={() => setPtaSeNaJmeno(true)}
                  className="ml-auto rounded-pill bg-brand-green text-black font-heading font-semibold text-sm px-5 py-2.5 border-0 cursor-pointer transition-transform hover:scale-[1.02]"
                >
                  Mám zájem, schvaluji
                </button>
              </>
            )}
            {chyba && <p className="m-0 w-full font-body text-xs text-danger">{chyba}</p>}
          </div>
        </div>
      )}
    </main>
  );
}

function Sekce({
  id,
  cislo,
  nazev,
  popis,
  children,
}: {
  id: string;
  cislo: number;
  nazev: string;
  popis?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="font-heading font-semibold text-xs text-brand-purple uppercase tracking-[0.2em]">
          {String(cislo).padStart(2, '0')}
        </span>
        <h2 className="font-display text-2xl sm:text-4xl text-ink m-0">{nazev}</h2>
        {popis && <p className="font-body text-sm sm:text-base text-muted m-0 max-w-[60ch]">{popis}</p>}
      </div>
      {children}
    </section>
  );
}

function Karta({ children, zvyrazneno }: { children: React.ReactNode; zvyrazneno?: boolean }) {
  return (
    <div
      className={`rounded-card border bg-surface p-4 sm:p-5 transition-colors ${
        zvyrazneno ? 'border-brand-green' : 'border-line'
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Text psaný produkcí. Odstavce se dělají prázdným řádkem a řádek začínající
 * pomlčkou je odrážka - víc značek by znamenalo učit lidi psát HTML.
 */
function Proza({ text }: { text: string }) {
  const bloky = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-4 max-w-[68ch]">
      {bloky.map((blok, i) => {
        const radky = blok.split('\n').map((r) => r.trim());
        const odrazky = radky.every((r) => /^[-•*]\s+/.test(r));
        if (odrazky) {
          return (
            <ul key={i} className="list-none m-0 p-0 flex flex-col gap-2">
              {radky.map((r, j) => (
                <li key={j} className="flex items-start gap-2.5 font-body text-ink text-base leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-green shrink-0" aria-hidden="true" />
                  <span>{r.replace(/^[-•*]\s+/, '')}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="font-body text-ink text-base leading-relaxed m-0 whitespace-pre-wrap">
            {blok}
          </p>
        );
      })}
    </div>
  );
}

function Radek({ popisek, hodnota, zelena }: { popisek: string; hodnota: string; zelena?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-body text-sm text-muted">{popisek}</span>
      <span
        className={`font-body text-sm tabular-nums ${zelena ? 'text-brand-greenDeep' : 'text-ink'}`}
      >
        {hodnota}
      </span>
    </div>
  );
}
