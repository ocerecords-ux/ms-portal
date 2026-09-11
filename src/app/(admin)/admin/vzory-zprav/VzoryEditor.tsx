'use client';

import { useEffect, useRef, useState } from 'react';
import { PROMENNE, type Vzor } from '@/lib/vzoryZprav';

/**
 * Úprava vzorů zpráv (zadání 11. 9. 2026).
 *
 * Vlevo se píše, vpravo je vidět, jak zpráva dopadne — stejný model jako
 * u rodného listu a dokladů. Náhled se překresluje se zpožděním, aby se
 * server nevolal při každém klepnutí do klávesnice.
 *
 * Proměnné se vkládají kliknutím na značku, a to NA POZICI KURZORU: psát
 * „{projekt}" ručně je zbytečná příležitost k překlepu, a překlep by se
 * projevil až v odeslané zprávě.
 */

type VzorSeStavem = Vzor & { stav: string; upraveno: boolean; upravilJmeno: string | null };

export function VzoryEditor({ pocatecni }: { pocatecni: VzorSeStavem[] }) {
  const [vzory, setVzory] = useState(pocatecni);
  const [vybrany, setVybrany] = useState(pocatecni[0]?.stav ?? '');
  const [ulozeno, setUlozeno] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);

  const vzor = vzory.find((v) => v.stav === vybrany) ?? null;

  function uprav(zmena: Partial<Vzor>) {
    setVzory((soucasne) => soucasne.map((v) => (v.stav === vybrany ? { ...v, ...zmena } : v)));
    setUlozeno(null);
  }

  async function posli(init: RequestInit, url = '/api/admin/vzory-zprav') {
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || 'Nepodařilo se to uložit.');
        return false;
      }
      if (Array.isArray((data as { vzory?: VzorSeStavem[] }).vzory)) {
        setVzory((data as { vzory: VzorSeStavem[] }).vzory);
      }
      return true;
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
      return false;
    } finally {
      setPracuje(false);
    }
  }

  async function uloz() {
    if (!vzor) return;
    const ok = await posli({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stav: vzor.stav, predmet: vzor.predmet, nadpis: vzor.nadpis, text: vzor.text }),
    });
    if (ok) setUlozeno(vzor.stav);
  }

  async function vychozi() {
    if (!vzor) return;
    const ok = await posli({ method: 'DELETE' }, `/api/admin/vzory-zprav?stav=${encodeURIComponent(vzor.stav)}`);
    if (ok) setUlozeno(null);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-6 items-start">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {vzory.map((v) => (
            <button
              key={v.stav}
              type="button"
              onClick={() => {
                setVybrany(v.stav);
                setChyba(null);
              }}
              className={`px-3 py-1.5 text-xs font-heading font-semibold rounded-pill transition-colors ${
                v.stav === vybrany ? 'bg-brand-purple text-white' : 'bg-surface border border-line text-muted hover:text-ink'
              }`}
            >
              {v.stav}
              {v.upraveno && <span className="ml-1.5 opacity-70">•</span>}
            </button>
          ))}
        </div>

        {vzor && (
          <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
            <Pole
              popisek="Předmět"
              hodnota={vzor.predmet}
              onZmena={(v) => uprav({ predmet: v })}
              napoveda="Co uvidí klient v seznamu pošty."
            />
            <Pole
              popisek="Nadpis ve zprávě"
              hodnota={vzor.nadpis}
              onZmena={(v) => uprav({ nadpis: v })}
              placeholder="nepovinné — prázdné znamená bez nadpisu"
              napoveda="Velký nadpis nad textem. Nechte prázdné a zpráva vypadá jako doteď."
            />
            <PoleText hodnota={vzor.text} onZmena={(v) => uprav({ text: v })} />

            <div className="flex items-center gap-3 flex-wrap border-t border-line pt-4">
              <button
                type="button"
                onClick={() => void uloz()}
                disabled={pracuje || !vzor.text.trim()}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
              >
                {pracuje ? 'Ukládám…' : 'Uložit vzor'}
              </button>
              {ulozeno === vzor.stav && (
                <span className="text-sm font-heading text-brand-greenDeep">Uloženo</span>
              )}
              {vzor.upraveno && (
                <button
                  type="button"
                  onClick={() => void vychozi()}
                  disabled={pracuje}
                  className="ml-auto font-heading text-xs text-muted hover:text-danger disabled:opacity-50"
                >
                  Obnovit výchozí znění
                </button>
              )}
            </div>

            {chyba && (
              <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>
            )}
            {vzor.upraveno && vzor.upravilJmeno && (
              <p className="text-xs font-body text-muted m-0">Naposledy upravil(a): {vzor.upravilJmeno}</p>
            )}
          </div>
        )}
      </div>

      {vzor && <Nahled vzor={vzor} />}
    </div>
  );
}

/** Značky proměnných - kliknutím se vloží tam, kde je kurzor. */
function Znacky({ vloz }: { vloz: (znacka: string) => void }) {
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {PROMENNE.map((p) => (
        <button
          key={p.klic}
          type="button"
          onClick={() => vloz(`{${p.klic}}`)}
          title={`${p.popis} — v ukázce „${p.ukazka}“`}
          className="text-[11px] font-heading font-semibold rounded-pill border border-line bg-field px-2 py-0.5 text-brand-purple hover:border-brand-purple transition-colors"
        >
          {'{'}
          {p.klic}
          {'}'}
        </button>
      ))}
    </span>
  );
}

function Pole({
  popisek,
  hodnota,
  onZmena,
  napoveda,
  placeholder,
}: {
  popisek: string;
  hodnota: string;
  onZmena: (v: string) => void;
  napoveda?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-body text-ink">{popisek}</span>
        <Znacky vloz={(z) => onZmena(vlozNaKurzor(ref.current, hodnota, z, onZmena))} />
      </span>
      <input
        ref={ref}
        value={hodnota}
        placeholder={placeholder}
        onChange={(e) => onZmena(e.target.value)}
        className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
      />
      {napoveda && <span className="text-xs text-muted font-body">{napoveda}</span>}
    </label>
  );
}

function PoleText({ hodnota, onZmena }: { hodnota: string; onZmena: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-body text-ink">Text zprávy</span>
        <Znacky vloz={(z) => onZmena(vlozNaKurzor(ref.current, hodnota, z, onZmena))} />
      </span>
      <textarea
        ref={ref}
        value={hodnota}
        onChange={(e) => onZmena(e.target.value)}
        rows={7}
        className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-body text-sm outline-none focus:border-brand-purple resize-y"
      />
      <span className="text-xs text-muted font-body">
        Prázdný řádek oddělí odstavce. Odkazy psát nemusíte — tlačítka na složku a na AudioTagger
        se do zprávy doplní sama.
      </span>
    </label>
  );
}

/** Vloží značku na pozici kurzoru; bez kurzoru ji připíše na konec. */
function vlozNaKurzor(
  pole: HTMLInputElement | HTMLTextAreaElement | null,
  hodnota: string,
  znacka: string,
  onZmena: (v: string) => void,
): string {
  if (!pole) return `${hodnota}${znacka}`;
  const od = pole.selectionStart ?? hodnota.length;
  const do_ = pole.selectionEnd ?? od;
  const nova = `${hodnota.slice(0, od)}${znacka}${hodnota.slice(do_)}`;
  // Kurzor za vlozenou znacku, at se da psat dal.
  window.setTimeout(() => {
    pole.focus();
    pole.setSelectionRange(od + znacka.length, od + znacka.length);
  }, 0);
  onZmena(nova);
  return nova;
}

/**
 * Náhled zprávy. Překresluje se se zpožděním - server by jinak dostal
 * požadavek na každé klepnutí do klávesnice.
 */
function Nahled({ vzor }: { vzor: VzorSeStavem }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    const casovac = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/vzory-zprav/nahled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stav: vzor.stav, nadpis: vzor.nadpis, text: vzor.text }),
        });
        if (res.ok) setHtml(await res.text());
      } catch {
        // vypadek site - nahled se prekresli pri dalsi zmene
      }
    }, 400);
    return () => window.clearTimeout(casovac);
  }, [vzor.stav, vzor.nadpis, vzor.text]);

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden xl:sticky xl:top-4">
      <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Jak zpráva dopadne
        </h2>
        <span className="text-[11px] font-body text-muted">ukázková data</span>
      </div>
      <iframe
        title="Náhled zprávy"
        srcDoc={html}
        className="w-full block bg-white"
        style={{ height: '72vh', border: 0 }}
      />
    </div>
  );
}
