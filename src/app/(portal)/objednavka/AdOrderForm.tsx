'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';
import { KresbaIkony } from '@/lib/ikonyTypu';
import { SLUZBY_REKLAMY, nazvySluzeb } from '@/lib/sluzbyReklamy';

/**
 * OBJEDNÁVKA REKLAMY JAKO PRŮVODCE (zadání 25. 9. 2026: „pojďme hromadně
 * předělat objednávky u klientů reklam. Tam to bude hodně jiné než u klientů
 * audioknih… možná bych ty položky, co má klient vyplnit, mohly skákat jako
 * průvodce, krok za krokem").
 *
 * Jedna otázka na obrazovku: název, co od nás klient chce, herec, termín.
 * Dlouhý formulář, ve kterém je půlka polí pro někoho jiného, odradí; takhle
 * je pokaždé vidět jen to, na co se zrovna odpovídá, a nahoře kolik toho
 * zbývá.
 *
 * CO SE PTÁ POVINNĚ: jenom název a aspoň jedna služba. Herce ani termín klient
 * vědět nemusí - od toho jsme my; oba kroky se dají přeskočit.
 *
 * Ceny tu zatím nejsou (zadání tentýž den: „uděláme tam nějaké výpočty ceny
 * apod." - až se doladí). Číselník služeb v lib/sluzbyReklamy.ts už na ceník
 * odkazuje, takže se cena doplní tam, ne tady ve formuláři.
 */
const KROKY = ['nazev', 'sluzby', 'herec', 'termin', 'shrnuti'] as const;
type Krok = (typeof KROKY)[number];

const NADPISY: Record<Krok, { nadpis: string; podnadpis: string }> = {
  nazev: { nadpis: 'Jak se zakázka jmenuje?', podnadpis: 'Stačí pracovní název, ať ji oba poznáme.' },
  sluzby: { nadpis: 'Co pro vás máme udělat?', podnadpis: 'Vyberte všechno, co k zakázce patří.' },
  herec: { nadpis: 'Máte představu o hlasu?', podnadpis: 'Když ne, nevadí — vybereme a pošleme ukázky.' },
  termin: { nadpis: 'Do kdy to potřebujete?', podnadpis: 'Termín odevzdání hotového zvuku.' },
  shrnuti: { nadpis: 'Sedí to?', podnadpis: 'Ještě můžete přidat poznámku nebo podklady.' },
};

export function AdOrderForm() {
  const router = useRouter();
  const [krok, setKrok] = useState<Krok>('nazev');
  const [title, setTitle] = useState('');
  const [sluzby, setSluzby] = useState<string[]>([]);
  const [herec, setHerec] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const vstupSouboru = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [varovani, setVarovani] = useState<string | null>(null);
  const [lastTitle, setLastTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const index = KROKY.indexOf(krok);
  const muzeDal =
    (krok === 'nazev' && title.trim().length > 0) ||
    (krok === 'sluzby' && sluzby.length > 0) ||
    krok === 'herec' ||
    krok === 'termin';

  function odeberSoubor() {
    setFile(null);
    if (vstupSouboru.current) vstupSouboru.current.value = '';
  }

  function prepniSluzbu(klic: string) {
    setSluzby((s) => (s.includes(klic) ? s.filter((k) => k !== klic) : [...s, klic]));
  }

  async function odesli() {
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('kind', 'AD');
      formData.set('title', title);
      formData.set('deadline', deadline);
      formData.set('note', note);
      formData.set('preferredNarrator', herec);
      for (const k of sluzby) formData.append('sluzby', k);
      if (file) {
        const klic = await nahrajPrilohu(file);
        formData.set('attachmentKey', klic);
        formData.set('attachmentName', file.name);
      }

      const res = await fetch('/api/orders', { method: 'POST', body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Objednávku se nepodařilo odeslat.');

      setLastTitle(title);
      setVarovani(body?.varovani ?? null);
      setDone(true);
      setTitle('');
      setSluzby([]);
      setHerec('');
      setDeadline('');
      setNote('');
      setFile(null);
      setKrok('nazev');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Objednávku se nepodařilo odeslat.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
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
            „{lastTitle}" — objednávku jsme uložili k vašemu účtu a Mediaspace se vám brzy ozve.
          </p>
          {varovani && (
            <p className="mt-3 mb-0 rounded-lg bg-white/15 border border-brand-green px-3 py-2 text-sm font-body text-white">
              {varovani}
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
      onSubmit={(e) => {
        e.preventDefault();
        if (krok === 'shrnuti') void odesli();
        else if (muzeDal) setKrok(KROKY[index + 1]);
      }}
      className="bg-brand-purple rounded-card p-6 sm:p-10 text-white max-w-2xl mx-auto flex flex-col gap-6"
    >
      {/* Kolik toho zbývá - proužek a krok X ze Y. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-heading text-brand-green uppercase tracking-wide">
            Krok {index + 1} z {KROKY.length}
          </span>
          <span className="text-xs font-body text-white/70">Objednávka</span>
        </div>
        <div className="h-1.5 rounded-pill bg-white/15 overflow-hidden">
          <div
            className="h-full bg-brand-green transition-all duration-300"
            style={{ width: `${((index + 1) / KROKY.length) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-brand-green m-0">{NADPISY[krok].nadpis}</h2>
        <p className="text-white/85 text-sm font-body mt-1.5 mb-0">{NADPISY[krok].podnadpis}</p>
      </div>

      {krok === 'nazev' && (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="např. Vánoční kampaň 2026"
          className="input"
        />
      )}

      {krok === 'sluzby' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SLUZBY_REKLAMY.map((s) => {
            const vybrano = sluzby.includes(s.klic);
            return (
              <button
                key={s.klic}
                type="button"
                onClick={() => prepniSluzbu(s.klic)}
                aria-pressed={vybrano}
                className={`text-left rounded-card border-2 p-4 flex flex-col gap-2 transition-colors ${
                  vybrano
                    ? 'border-brand-green bg-brand-green/15'
                    : 'border-white/25 bg-white/5 hover:border-white/60'
                }`}
              >
                <span
                  className={`grid place-items-center w-10 h-10 rounded-pill ${
                    vybrano ? 'bg-brand-green text-brand-purpleDark' : 'bg-white/10 text-white'
                  }`}
                >
                  <KresbaIkony klic={s.ikona} velikost={20} />
                </span>
                <span className="font-heading font-semibold text-sm text-white">{s.nazev}</span>
                <span className="text-xs font-body text-white/70 leading-snug">{s.popis}</span>
              </button>
            );
          })}
        </div>
      )}

      {krok === 'herec' && (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            value={herec}
            onChange={(e) => setHerec(e.target.value)}
            placeholder="např. mužský hlas, 40+, klidný — nebo konkrétní jméno"
            className="input"
          />
          <span className="text-xs font-body text-white/70">
            Klidně nechte prázdné. Podle zakázky vybereme hlasy a pošleme vám ukázky.
          </span>
        </div>
      )}

      {krok === 'termin' && (
        <div className="flex flex-col gap-2">
          <DatumPole value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" />
          <span className="text-xs font-body text-white/70">
            Když termín ještě neznáte, přeskočte to — domluvíme se.
          </span>
        </div>
      )}

      {krok === 'shrnuti' && (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 m-0 rounded-card bg-white/10 p-4">
            <Polozka popisek="Název" hodnota={title || '—'} naKrok={() => setKrok('nazev')} />
            <Polozka
              popisek="Co pro vás uděláme"
              hodnota={nazvySluzeb(sluzby).join(', ') || '—'}
              naKrok={() => setKrok('sluzby')}
            />
            <Polozka popisek="Hlas" hodnota={herec || 'necháváme na vás'} naKrok={() => setKrok('herec')} />
            <Polozka
              popisek="Termín"
              hodnota={deadline ? new Intl.DateTimeFormat('cs-CZ').format(new Date(deadline)) : 'domluvíme se'}
              naKrok={() => setKrok('termin')}
            />
          </dl>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-heading text-white">Poznámka</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Cokoliv, co bychom měli vědět — tonalita, stopáž, kde se spot bude hrát…"
              className="input"
            />
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
            className={`rounded-card border-2 border-dashed px-4 py-5 text-center transition-colors ${
              dragOver ? 'border-brand-green bg-brand-green/10' : 'border-white/30'
            }`}
          >
            <input
              ref={vstupSouboru}
              type="file"
              id="priloha-reklama"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            {file ? (
              <span className="inline-flex items-center gap-3 flex-wrap justify-center">
                <span className="text-sm font-body text-white">{file.name}</span>
                <button
                  type="button"
                  onClick={odeberSoubor}
                  className="text-xs font-heading text-brand-green underline bg-transparent border-0 cursor-pointer"
                >
                  Odebrat
                </button>
              </span>
            ) : (
              <label htmlFor="priloha-reklama" className="text-sm font-body text-white/80 cursor-pointer">
                Podklady (scénář, storyboard, hudba) — přetáhněte sem nebo klikněte
              </label>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="m-0 rounded-lg bg-white/15 border border-brand-green px-3 py-2 text-sm font-body text-white">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setKrok(KROKY[index - 1])}
            className="text-white/85 text-sm font-heading underline bg-transparent border-0 cursor-pointer px-1"
          >
            Zpět
          </button>
        )}
        <span className="flex-1" />
        {(krok === 'herec' || krok === 'termin') && (
          <button
            type="button"
            onClick={() => setKrok(KROKY[index + 1])}
            className="text-white/85 text-sm font-heading underline bg-transparent border-0 cursor-pointer px-1"
          >
            Přeskočit
          </button>
        )}
        <button
          type="submit"
          disabled={(krok !== 'shrnuti' && !muzeDal) || submitting}
          className="bg-brand-green text-brand-purpleDark font-heading font-semibold text-sm rounded-lg px-8 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {krok === 'shrnuti' ? (submitting ? 'Odesílám…' : 'Odeslat objednávku') : 'Pokračovat'}
        </button>
      </div>
    </form>
  );
}

function Polozka({
  popisek,
  hodnota,
  naKrok,
}: {
  popisek: string;
  hodnota: string;
  naKrok: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs font-heading text-white/60 uppercase tracking-wide">{popisek}</dt>
      <dd className="m-0 text-sm font-body text-white flex items-center gap-2 min-w-0">
        <span className="min-w-0 break-words">{hodnota}</span>
        <button
          type="button"
          onClick={naKrok}
          className="shrink-0 text-xs font-heading text-brand-green underline bg-transparent border-0 cursor-pointer"
        >
          upravit
        </button>
      </dd>
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
