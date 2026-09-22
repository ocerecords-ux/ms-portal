'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NarratorMultiSelect, type NarratorOption } from './NarratorMultiSelect';
import {
  formatujCislo,
  formatujNormostrany,
  sklonujNormostrany,
  spoctiNormostrany,
  umimeSpocitat,
  zaokrouhliNormostrany,
  ZNAKU_NA_NORMOSTRANU,
  type RozborTextu,
} from '@/lib/normostrany';
import { DatumPole } from '@/components/DatumPole';
import { UpravaPdf } from './UpravaPdf';
import { vygenerujUvod, vygenerujZaver, REZISER_UVODU } from '@/lib/uvodZaver';

export function OrderForm({
  ratePerPage,
  herci,
  uvodZaver = false,
}: {
  ratePerPage: number;
  herci: NarratorOption[];
  /** Úvod a závěr audioknihy (22. 9. 2026) - zatím jen Audiotéka. */
  uvodZaver?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [narrators, setNarrators] = useState<string[]>([]);
  const [note, setNote] = useState('');
  /**
   * ÚVOD A ZÁVĚR (zadání 22. 9. 2026). Text se skládá sám z názvu, autora,
   * překladatele a nakladatelství - dokud do něj klient nesáhne. Jakmile ho
   * přepíše, drží se jeho znění a automat ho už nepřepisuje; tlačítkem se dá
   * vrátit k automatickému.
   */
  const [autor, setAutor] = useState('');
  const [prekladatel, setPrekladatel] = useState('');
  const [nakladatelstvi, setNakladatelstvi] = useState('');
  const [uvodVlastni, setUvodVlastni] = useState<string | null>(null);
  const [zaverVlastni, setZaverVlastni] = useState<string | null>(null);
  const udajeUvodu = { nazev: title, autor, prekladatel, nakladatelstvi, herec: narrators.join(', ') };
  const uvodText = uvodVlastni ?? vygenerujUvod(udajeUvodu);
  const zaverText = zaverVlastni ?? vygenerujZaver(udajeUvodu);
  const [file, setFile] = useState<File | null>(null);
  /**
   * Původní PDF, jak ho klient vybral (22. 9. 2026) - z něj se kreslí náhled
   * stránek. `file` je to, co se odešle: po vyřazení nebo otočení stránek
   * už upravená kopie.
   */
  const [puvodniPdf, setPuvodniPdf] = useState<File | null>(null);
  const vyberSoubor = (f: File | null) => {
    setFile(f);
    setPuvodniPdf(f && /\.pdf$/i.test(f.name) ? f : null);
  };
  const [dragOver, setDragOver] = useState(false);
  /**
   * Normostrany z přiloženého textu (zadání 12. 9. 2026: „když tam načteš
   * přílohu s textem, tak ti to rovnou přepočítá normostrany").
   */
  const [rozbor, setRozbor] = useState<RozborTextu | null>(null);
  const [pocitam, setPocitam] = useState(false);
  const [chybaRozboru, setChybaRozboru] = useState<string | null>(null);
  /** Puvodni technicka hlaska - schovana pod „Podrobnosti". */
  const [detailChyby, setDetailChyby] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ title: string; price: number; varovani: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const price = useMemo(() => {
    const n = parseFloat(pageCount) || 0;
    return Math.round(n * ratePerPage);
  }, [pageCount, ratePerPage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('kind', 'AUDIOBOOK');
      formData.set('title', title);
      formData.set('pageCount', pageCount);
      formData.set('deadline', deadline);
      formData.set('preferredNarrator', narrators.join(', '));
      formData.set('note', note);
      if (uvodZaver) {
        formData.set('autorKnihy', autor);
        formData.set('prekladatelKnihy', prekladatel);
        formData.set('nakladatelstviKnihy', nakladatelstvi);
        formData.set('uvodKnihy', uvodText);
        formData.set('zaverKnihy', zaverText);
      }
      // Priloha jde do uloziste zvlast, objednavka pak nese jen klic.
      if (file) {
        const klic = await nahrajPrilohu(file);
        formData.set('attachmentKey', klic);
        formData.set('attachmentName', file.name);
      }

      const res = await fetch('/api/orders', { method: 'POST', body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Objednávku se nepodařilo odeslat.');
      }
      // Objednavka projde i tehdy, kdyz se prilohu nepodari ulozit - ale
      // odesilatel se to musi dozvedet, jinak si mysli, ze podklady dorazily
      // (oprava 9. 9. 2026).
      setLastOrder({ title, price, varovani: body?.varovani ?? null });
      setDone(true);
      setTitle('');
      setPageCount('');
      setDeadline('');
      setNarrators([]);
      setNote('');
      setAutor('');
      setPrekladatel('');
      setNakladatelstvi('');
      setUvodVlastni(null);
      setZaverVlastni(null);
      vyberSoubor(null);
      setRozbor(null);
      setChybaRozboru(null);
      setDetailChyby(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Objednávku se nepodařilo odeslat.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) vyberSoubor(dropped);
  }

  /**
   * Počítání běží CELÉ V PROHLÍŽEČI (viz lib/normostrany.ts) - rukopis se
   * nikam neposílá a výsledek je hned. Pustí se samo, jakmile klient soubor
   * vybere; do políčka se počet doplní jen tehdy, když si tam nic nenapsal
   * sám. Přepsat mu ručně zadané číslo by bylo horší než nespočítat nic.
   */
  const pocetRef = useRef(pageCount);
  pocetRef.current = pageCount;

  const prepocitej = useCallback(async (soubor: File, doplnitVzdy: boolean) => {
    setPocitam(true);
    setChybaRozboru(null);
    setDetailChyby(null);
    try {
      const vysledek = await spoctiNormostrany(soubor);
      setRozbor(vysledek);
      if (doplnitVzdy || !pocetRef.current.trim()) {
        setPageCount(String(zaokrouhliNormostrany(vysledek.normostran)));
      }
    } catch (err) {
      // Do okna jde srozumitelna veta, do konzole cela chyba - jinak se
      // nedopatrame, proc to u konkretniho souboru nesedlo.
      console.error('Normostrany se nepodarilo spocitat:', err);
      setRozbor(null);
      const hlaska = err instanceof Error ? err.message : String(err ?? '');
      setDetailChyby(
        `${soubor.name} · ${hlaska || 'bez hlášky'}${
          typeof navigator !== 'undefined' ? ` · ${navigator.userAgent}` : ''
        }`,
      );
      setChybaRozboru(
        hlaska && hlaska.length < 120 && /[ěščřžýáíéúůťďň ]/i.test(hlaska)
          ? hlaska
          : 'Text z tohohle souboru se nepodařilo přečíst. Zkuste ho prosím poslat jako Word (.docx) nebo TXT.',
      );
    } finally {
      setPocitam(false);
    }
  }, []);

  useEffect(() => {
    setRozbor(null);
    setChybaRozboru(null);
    setDetailChyby(null);
    if (!file) return;
    if (!umimeSpocitat(file.name)) return;
    void prepocitej(file, false);
  }, [file, prepocitej]);

  if (done && lastOrder) {
    return (
      <div className="bg-brand-purple rounded-card p-6 sm:p-10 text-white max-w-2xl mx-auto flex flex-col items-start gap-5">
        <div className="w-14 h-14 rounded-full bg-brand-green flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#201a33" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M4 12l6 6L20 6" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-brand-green m-0">Objednávka byla odeslána</h2>
          <p className="text-white/85 text-sm font-body mt-2">
            „{lastOrder.title}" — předběžná cena{' '}
            <strong className="text-brand-green">{new Intl.NumberFormat('cs-CZ').format(lastOrder.price)} Kč</strong>.
            Objednávku jsme uložili k vašemu účtu a Mediaspace se vám brzy ozve.
          </p>
          {lastOrder.varovani && (
            <p className="mt-3 mb-0 rounded-lg bg-white/15 border border-brand-green px-3 py-2 text-sm font-body text-white">
              {lastOrder.varovani}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setDone(false)}
            className="border-2 border-brand-green text-brand-green font-heading font-semibold text-sm rounded-lg px-8 py-3 hover:bg-brand-green hover:text-brand-purpleDark transition-colors"
          >
            + Vytvořit další objednávku
          </button>
          <Link href="/projekty" className="text-white/85 text-sm font-heading underline">
            Zobrazit Projekty
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative bg-brand-purple rounded-card p-6 sm:p-10 text-white max-w-2xl mx-auto flex flex-col gap-5"
    >
      {/* Odesilani neni okamzite - priloha muze mit desitky megabajtu.
          Misto tiche pauzy prebehne pres formular clona s rozehranym logem
          (zadani 12. 9. 2026: „bylo by tam super vymaslet nejakou pohyblivou
          vec, kdyz se to bude odesilat"). Clona zaroven zabrani druhemu
          kliknuti na Odeslat. */}
      {submitting && (
        <div className="absolute inset-0 z-10 rounded-card bg-brand-purpleDeep/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mediaspace-logo.gif" alt="" aria-hidden="true" className="h-16 w-auto" />
          <p className="m-0 font-heading font-semibold text-sm text-brand-green">Odesíláme objednávku…</p>
          <span className="block w-40 h-[3px] rounded-full bg-white/20 overflow-hidden">
            <span className="block h-full w-1/3 rounded-full bg-brand-green animate-[objednavka-pruh_1.1s_ease-in-out_infinite]" />
          </span>
        </div>
      )}

      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-brand-green m-0">Objednávka audioknihy</h2>
        <p className="text-white/75 text-xs font-heading mt-1.5">
          Vaše sazba: <strong className="text-brand-green font-semibold">{ratePerPage} Kč</strong> / normostrana, bez DPH
        </p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Field label="Název" required className="flex-[2_1_200px]">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="např. Stín nad Vltavou"
            className="input"
          />
        </Field>
        <Field label="Počet normostran" className="flex-1 min-w-[140px]">
          <input
            type="number"
            min={0}
            step={1}
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            placeholder="0"
            className="input"
          />
        </Field>
        <Field
          label="Cena bez DPH"
          className="flex-1 min-w-[140px]"
          tooltip="Cena se vypočítává dle dohodnuté ceny za normostranu. Uvedená částka je bez DPH."
        >
          <input
            readOnly
            value={`${new Intl.NumberFormat('cs-CZ').format(price)} Kč`}
            title="Cena se vypočítává dle dohodnuté ceny za normostranu. Uvedená částka je bez DPH."
            className="input input-readonly"
          />
        </Field>
      </div>

      <Field label="Datum odevzdání">
        <DatumPole value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
      </Field>

      <Field label="Preferovaný herec" tooltip="Vyberte jednoho nebo víc herců z databáze, nebo napište vlastní jméno.">
        <NarratorMultiSelect options={herci} value={narrators} onChange={setNarrators} />
      </Field>

      {uvodZaver && (
        <div className="flex flex-col gap-3 rounded-lg border border-white/20 bg-white/5 p-4">
          <div>
            <p className="m-0 font-heading font-semibold text-sm text-brand-green">Úvod a závěr audioknihy</p>
            <p className="m-0 mt-1 text-[11px] font-body text-white/75">
              Text se složí sám z údajů níže. Můžete ho upravit, nebo celý přepsat vlastním. Režie je vždy{' '}
              {REZISER_UVODU}.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap">
            <Field label="Autor" className="flex-1 min-w-[180px]">
              <input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="např. Emil Hruška" className="input" />
            </Field>
            <Field label="Překladatel" className="flex-1 min-w-[180px]">
              <input
                value={prekladatel}
                onChange={(e) => setPrekladatel(e.target.value)}
                placeholder="u původně české knihy nechte prázdné"
                className="input"
              />
            </Field>
            <Field label="Nakladatelství" className="flex-1 min-w-[180px]">
              <input
                value={nakladatelstvi}
                onChange={(e) => setNakladatelstvi(e.target.value)}
                placeholder="např. Epocha"
                className="input"
              />
            </Field>
          </div>
          <TextUvodu
            nadpis="Úvod"
            hodnota={uvodText}
            vlastni={uvodVlastni !== null}
            onZmena={setUvodVlastni}
            onVratit={() => setUvodVlastni(null)}
          />
          <TextUvodu
            nadpis="Závěr"
            hodnota={zaverText}
            vlastni={zaverVlastni !== null}
            onZmena={setZaverVlastni}
            onVratit={() => setZaverVlastni(null)}
          />
        </div>
      )}

      <Field label="Poznámka">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Cokoliv, co bychom měli vědět k objednávce…"
          className="input min-h-[90px] font-body resize-y"
        />
      </Field>

      <Field label="Příloha">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={`flex flex-col items-center justify-center gap-2 border-[1.5px] border-dashed rounded-lg px-4 py-8 text-sm text-white/85 text-center transition-colors ${
            dragOver ? 'border-white bg-white/15' : 'border-brand-green bg-white/5'
          }`}
        >
          <span className="truncate">
            {file ? file.name : dragOver ? 'Pusťte soubor sem…' : 'Přetáhněte soubor sem, nebo ho vyberte'}
          </span>
          <label className="ml-auto shrink-0 bg-white text-brand-purpleDeep rounded-md px-3 py-1.5 text-xs font-heading font-semibold cursor-pointer">
            Vybrat soubor
            <input type="file" className="hidden" onChange={(e) => vyberSoubor(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {/* Náhled a úprava PDF - mazání a otáčení stránek (22. 9. 2026). */}
        {puvodniPdf && <UpravaPdf soubor={puvodniPdf} onZmena={setFile} />}

        {/* Kalkulačka normostran nad přílohou (zadání 12. 9. 2026). */}
        {file && (
          <div className="mt-2">
            {pocitam && (
              <p className="m-0 text-xs font-body text-white/80">Počítám normostrany z textu…</p>
            )}

            {!pocitam && rozbor && (
              <div className="rounded-lg border border-brand-green bg-white/10 px-3.5 py-3">
                <p className="m-0 font-heading font-semibold text-sm text-brand-green">
                  Text má {formatujNormostrany(rozbor.normostran)} {sklonujNormostrany(rozbor.normostran)}
                </p>
                <p className="m-0 mt-1 text-[11px] font-body text-white/75">
                  {formatujCislo(rozbor.znaku)} znaků včetně mezer · {formatujCislo(rozbor.slov)} slov ·{' '}
                  {rozbor.zdroj}
                  {rozbor.stran ? ` · ${rozbor.stran} stran v souboru` : ''}
                </p>
                <p className="m-0 mt-1 text-[11px] font-body text-white/55">
                  Normostrana = {formatujCislo(ZNAKU_NA_NORMOSTRANU)} znaků včetně mezer, započatá strana se
                  počítá celá. Počet v objednávce můžete kdykoliv přepsat.
                </p>
                {pageCount !== String(zaokrouhliNormostrany(rozbor.normostran)) && (
                  <button
                    type="button"
                    onClick={() => setPageCount(String(zaokrouhliNormostrany(rozbor.normostran)))}
                    className="mt-2 bg-brand-green text-brand-purpleDark rounded-md px-3 py-1.5 text-xs font-heading font-semibold"
                  >
                    Doplnit {zaokrouhliNormostrany(rozbor.normostran)} do objednávky
                  </button>
                )}
              </div>
            )}

            {!pocitam && chybaRozboru && (
              <div className="rounded-lg border border-white/30 bg-white/10 px-3.5 py-2.5 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-body text-white/85">{chybaRozboru}</span>
                <button
                  type="button"
                  onClick={() => void prepocitej(file, true)}
                  className="text-xs font-heading font-semibold text-brand-green underline"
                >
                  Zkusit znovu
                </button>
                {/* Puvodni hlaska na jedno kliknuti - at ji jde poslat dal,
                    aniz by clovek otviral konzoli prohlizece. */}
                {detailChyby && (
                  <details className="w-full">
                    <summary className="cursor-pointer text-[11px] font-heading text-white/60">
                      Podrobnosti
                    </summary>
                    <p className="m-0 mt-1 text-[11px] font-mono text-white/70 break-words">{detailChyby}</p>
                  </details>
                )}
              </div>
            )}

            {!pocitam && !rozbor && !chybaRozboru && !umimeSpocitat(file.name) && (
              <p className="m-0 text-xs font-body text-white/60">
                Z tohohle souboru normostrany spočítat neumím. Umím Word (.docx), PDF, RTF, ODT, EPUB a TXT.
              </p>
            )}

            {!pocitam && umimeSpocitat(file.name) && (rozbor || chybaRozboru) && (
              <button
                type="button"
                onClick={() => void prepocitej(file, true)}
                className="mt-2 text-[11px] font-heading font-semibold text-white/70 underline"
              >
                Spočítat z textu znovu
              </button>
            )}
          </div>
        )}
      </Field>

      {error && <p className="bg-red-500/30 rounded-lg px-3.5 py-2.5 text-sm">{error}</p>}

      <div className="flex items-center gap-4 flex-wrap mt-1">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2.5 border-2 border-brand-green text-brand-green font-heading font-semibold text-sm rounded-lg px-8 py-3 hover:bg-brand-green hover:text-brand-purpleDark transition-colors disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-brand-green"
        >
          {/* Za odesilani se rozbehne logo Mediaspace - stejna vlnka jako
              v AudioTaggeru, kdyz hraje nahravka (zadani 12. 9. 2026:
              „bylo by tam super vymaslet nejakou pohyblivou vec, kdyz se to
              bude odesilat"). Neni to tocici se kolecko, ktere vypada jako
              v kazde aplikaci. */}
          {submitting && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/mediaspace-logo.gif" alt="" aria-hidden="true" className="h-5 w-auto" />
          )}
          {submitting ? 'Odesílám…' : 'Odeslat'}
        </button>
      </div>

      <style jsx>{`
        .input {
          font-family: 'Acid Grotesk', var(--font-inter);
          font-size: 14.5px;
          border-radius: 8px;
          border: 1.5px solid #1fdf67;
          padding: 11px 13px;
          background: #fff;
          color: #201a33;
          width: 100%;
        }
        .input::placeholder {
          color: #a9a2c2;
        }
        .input:focus {
          outline: none;
          border-color: #fff;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
        }
        .input-readonly {
          background: #f6f6f6;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          border-style: dashed;
        }

      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  tooltip,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[13.5px] font-body text-white inline-flex items-center gap-1.5">
        {label}
        {required && <span className="text-brand-green ml-0.5">*</span>}
        {tooltip && (
          <span
            title={tooltip}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-white/50 text-white/70 text-[10px] leading-none cursor-help shrink-0"
            aria-label={tooltip}
          >
            i
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

/**
 * Pošle přílohu rovnou do úložiště a vrátí klíč, pod kterým tam leží
 * (oprava 16. 9. 2026: „klientovi se nepodařilo odeslat objednávku").
 *
 * Soubor SCHVÁLNĚ NEJDE PŘES PORTÁL: funkce na Vercelu mají strop na velikost
 * požadavku kolem 4,5 MB a naskenovaný rukopis ho přeleze snadno — objednávka
 * pak spadla na chybu 413 a formulář uměl říct jen „nepodařilo se odeslat".
 * Stejnou cestou posílá soubory chat.
 */
async function nahrajPrilohu(soubor: File): Promise<string> {
  const podpis = await fetch('/api/orders/priloha/podpis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: soubor.name, mime: soubor.type, size: soubor.size }),
  });
  const data = await podpis.json().catch(() => ({}));
  if (!podpis.ok || !data?.uploadUrl) {
    throw new Error(data?.error || 'Přílohu se nepodařilo připravit k odeslání.');
  }

  const nahrano = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': soubor.type || 'application/octet-stream' },
    body: soubor,
  });
  if (!nahrano.ok) {
    throw new Error('Přílohu se nepodařilo nahrát. Zkuste to prosím znovu.');
  }
  return data.key as string;
}

/** Jeden text (úvod nebo závěr) - automatický, dokud ho klient nepřepíše. */
function TextUvodu({
  nadpis,
  hodnota,
  vlastni,
  onZmena,
  onVratit,
}: {
  nadpis: string;
  hodnota: string;
  vlastni: boolean;
  onZmena: (text: string) => void;
  onVratit: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] font-body text-white">{nadpis}</span>
        <span className="text-[11px] font-body text-white/60">{vlastni ? 'upraveno ručně' : 'skládá se automaticky'}</span>
        {vlastni && (
          <button
            type="button"
            onClick={onVratit}
            className="ml-auto text-[11px] font-heading font-semibold text-brand-green hover:underline"
          >
            Vrátit automatický text
          </button>
        )}
      </div>
      <textarea
        value={hodnota}
        onChange={(e) => onZmena(e.target.value)}
        className="input min-h-[80px] font-body resize-y"
      />
    </div>
  );
}
