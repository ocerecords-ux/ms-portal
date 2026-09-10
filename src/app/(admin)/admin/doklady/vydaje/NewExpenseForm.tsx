'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { Currency, PaymentMethod } from '@prisma/client';
import { CURRENCIES, CURRENCY_NAMES, formatMoney, minorToInput, parseMoneyToMinor } from '@/lib/doklady';
import { EXPENSE_VAT_RATES, expenseTotalMinor } from '@/lib/expenses';
import { MAX_FOTKA_BYTES, ZPUSOBY_UHRADY, zaplacenoRovnou, type PrectenaUctenka } from '@/lib/uctenka';
import { ProjectSelect, type ProjectChoice } from '../ProjectSelect';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';

/**
 * Zadání přijatého dokladu. Schválně jedna obrazovka bez překlikávání —
 * doklady se zadávají po dávkách, takže je důležité, aby to šlo rychle.
 * Částka se zadává BEZ DPH, sazba se u každého dokladu nastaví zvlášť
 * (herci nejsou vždy plátci) a 0 % znamená bez DPH.
 */
export function NewExpenseForm({
  categories,
  issuers,
  projects,
}: {
  categories: { id: string; name: string }[];
  issuers: { id: string; name: string; isDefault: boolean; currency: Currency }[];
  projects: ProjectChoice[];
}) {
  const router = useRouter();
  const defaultIssuer = issuers.find((i) => i.isDefault) ?? issuers[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);

  // Prisel sem clovek pres rychlou volbu z leveho panelu? Pak rovnou
  // rozbalit - zkratka ma vest do editacniho okna, ne jen na stranku
  // (zadani 9. 9. 2026).
  useOtevriZeZkratky(() => setOpen(true));
  const [form, setForm] = useState({
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    number: '',
    categoryId: categories[0]?.id ?? '',
    caflouProjectId: '',
    issuerCompanyId: defaultIssuer?.id ?? '',
    currency: (defaultIssuer?.currency ?? 'CZK') as Currency,
    description: '',
    amount: '',
    vatRate: 21,
    paid: false,
    paymentMethod: 'TRANSFER' as PaymentMethod,
    note: '',
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vyfoceny doklad (zadani 10. 9. 2026). Drzi se ve stavu, ne v inputu na
  // prilohu - do file inputu se soubor programove vlozit neda a fotka se
  // ma prilozit ke dokladu stejne jako rucne vybrany soubor.
  const [fotka, setFotka] = useState<File | null>(null);
  const [cteni, setCteni] = useState(false);
  const [cteniZprava, setCteniZprava] = useState<string | null>(null);

  // Kategorie se daji zalozit primo tady (zadani 8. 9. 2026) - kdyz se zadava
  // doklad a kategorie jeste neexistuje, neni duvod kvuli tomu odchazet pryc.
  const [kategorie, setKategorie] = useState(categories);
  const [novaKategorie, setNovaKategorie] = useState<string | null>(null);
  const [kategorieBusy, setKategorieBusy] = useState(false);

  async function zalozitKategorii() {
    const name = (novaKategorie ?? '').trim();
    if (!name) return;
    setKategorieBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Kategorii se nepodařilo přidat.');
        return;
      }
      setKategorie((list) => [...list, { id: data.id, name: data.name }]);
      set('categoryId', data.id);
      setNovaKategorie(null);
      router.refresh();
    } catch {
      setError('Kategorii se nepodařilo přidat.');
    } finally {
      setKategorieBusy(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /**
   * Predvyplni formular podle toho, co se podarilo z dokladu precist.
   *
   * Zamerne se prepisuji jen prazdna pole a datum - kdyz uz clovek neco
   * napsal, fotka mu to nema pretlucit. Ulozit musi vzdycky sam.
   */
  function predvyplnit(u: PrectenaUctenka) {
    setForm((f) => {
      const sazba = u.sazbaDph ?? f.vatRate;

      // Ve formulari se zadava castka BEZ DPH, na uctence byva jen celkem.
      let castka = f.amount;
      if (!castka.trim()) {
        if (u.castkaBezDph) {
          castka = u.castkaBezDph;
        } else if (u.castkaSDph) {
          const celkem = parseMoneyToMinor(u.castkaSDph);
          castka = celkem > 0 ? minorToInput(Math.round(celkem / (1 + sazba / 100))) : castka;
        }
      }

      const zpusob = u.zpusobUhrady ?? f.paymentMethod;
      const mena = u.mena && (CURRENCIES as readonly string[]).includes(u.mena) ? (u.mena as Currency) : f.currency;

      return {
        ...f,
        issueDate: u.datum || f.issueDate,
        number: f.number || u.cislo || '',
        description: f.description || [u.dodavatel, u.popis].filter(Boolean).join(' — '),
        amount: castka,
        vatRate: u.sazbaDph ?? f.vatRate,
        currency: mena,
        paymentMethod: zpusob,
        // Kartou a hotove je zaplaceno uz na miste (zadani 10. 9. 2026).
        paid: zaplacenoRovnou(zpusob) ? true : f.paid,
      };
    });
  }

  async function nactiZFotky(soubor: File) {
    setFotka(soubor);
    setFileName(soubor.name);
    setError(null);

    if (soubor.size > MAX_FOTKA_BYTES) {
      setCteniZprava('Fotka je moc velká na přečtení, údaje vyplňte ručně.');
      return;
    }

    setCteni(true);
    setCteniZprava(null);
    try {
      const body = new FormData();
      body.set('fotka', soubor);
      const res = await fetch('/api/admin/expenses/precti', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCteniZprava(data?.error || 'Doklad se nepodařilo přečíst, vyplňte údaje ručně.');
        return;
      }
      predvyplnit(data as PrectenaUctenka);
      const jistota = typeof data?.jistota === 'number' ? data.jistota : null;
      setCteniZprava(
        jistota !== null && jistota < 0.7
          ? 'Doklad šel číst špatně — překontrolujte prosím částku a datum.'
          : 'Údaje jsou z fotky — zkontrolujte je a uložte.',
      );
    } catch {
      setCteniZprava('Doklad se nepodařilo přečíst, vyplňte údaje ručně.');
    } finally {
      setCteni(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('issueDate', form.issueDate);
      if (form.dueDate) body.set('dueDate', form.dueDate);
      if (form.number) body.set('number', form.number);
      if (form.categoryId) body.set('categoryId', form.categoryId);
      if (form.caflouProjectId) body.set('caflouProjectId', form.caflouProjectId);
      if (form.issuerCompanyId) body.set('issuerCompanyId', form.issuerCompanyId);
      body.set('currency', form.currency);
      if (form.description) body.set('description', form.description);
      body.set('amount', form.amount);
      body.set('vatRate', String(form.vatRate));
      body.set('paid', form.paid ? 'true' : 'false');
      body.set('paymentMethod', form.paymentMethod);
      if (form.note) body.set('note', form.note);
      // Vyfoceny doklad ma prednost - kdyz clovek fotil, chce prilozit fotku.
      const file = fotka ?? fileRef.current?.files?.[0];
      if (file) body.set('attachment', file);

      const res = await fetch('/api/admin/expenses', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Doklad se nepodařilo uložit.');
        return;
      }
      // Po uložení zpátky na přehled (zadani 8. 9. 2026) - doklad je vidět
      // v seznamu a je jasné, že se opravdu uložil.
      // Projekt zustava vybrany - doklady k jednomu projektu chodi po davkach.
      setForm((f) => ({ ...f, number: '', description: '', amount: '', note: '', dueDate: '' }));
      setFileName(null);
      setFotka(null);
      setCteniZprava(null);
      if (fileRef.current) fileRef.current.value = '';
      if (fotoRef.current) fotoRef.current.value = '';
      setOpen(false);
      router.refresh();
    } catch {
      setError('Doklad se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  // Zivy prepocet na castku s DPH - jen kdyz uz je co pocitat.
  const bezDph = form.amount.trim() ? parseMoneyToMinor(form.amount) : null;
  const sDph = bezDph === null ? null : expenseTotalMinor(bezDph, form.vatRate);

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  if (!open) {
    return (
      <span id={KOTVA_NOVE}>
        <AddButton onClick={() => setOpen(true)}>Nový výdaj</AddButton>
      </span>
    );
  }

  return (
    <form id={KOTVA_NOVE}
      onSubmit={submit}
      className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4 w-full"
    >
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Nový výdaj</h2>

      {/* Vyfoceni dokladu (zadani 10. 9. 2026). Na mobilu otevre rovnou zadni
          fotoaparat, na pocitaci vyber souboru - stejne tlacitko posluzi obojimu. */}
      <div className="flex flex-wrap items-center gap-3 bg-tint border border-line rounded-lg px-4 py-3">
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const soubor = e.target.files?.[0];
            if (soubor) void nactiZFotky(soubor);
          }}
        />
        <button
          type="button"
          onClick={() => fotoRef.current?.click()}
          disabled={cteni}
          className="inline-flex items-center gap-2 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          <IkonaFotak />
          {cteni ? 'Čtu doklad…' : 'Vyfotit doklad'}
        </button>
        <span className="text-xs font-body text-muted flex-1 min-w-[200px]">
          {cteniZprava ?? 'Vyfoťte účtenku a částku, datum i DPH doplním za vás. Před uložením to zkontrolujte.'}
        </span>
      </div>

      {/* Nazev je prvni - zadava se jako prvni (zadani 8. 9. 2026). Dodavatel
          se u vydaje uz nevyplnuje vubec, je to zbytecny udaj. */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Název</span>
        <input
          required
          autoFocus
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="za co to bylo"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Datum dokladu</span>
          <input
            type="date"
            required
            value={form.issueDate}
            onChange={(e) => set('issueDate', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Splatnost</span>
          <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Číslo dokladu</span>
          <input value={form.number} onChange={(e) => set('number', e.target.value)} className={inputClass} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-body text-ink">Kategorie</span>
            <button
              type="button"
              onClick={() => setNovaKategorie(novaKategorie === null ? '' : null)}
              className="text-xs font-heading font-semibold text-brand-purple hover:text-brand-purpleDeep"
            >
              {novaKategorie === null ? '+ Nová kategorie' : 'Zrušit'}
            </button>
          </span>
          {novaKategorie === null ? (
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
              <option value="">— bez kategorie —</option>
              {kategorie.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex gap-2">
              <input
                autoFocus
                value={novaKategorie}
                onChange={(e) => setNovaKategorie(e.target.value)}
                onKeyDown={(e) => {
                  // Enter tady zaklada kategorii, ne odesila cely doklad.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void zalozitKategorii();
                  }
                  if (e.key === 'Escape') setNovaKategorie(null);
                }}
                placeholder="např. Marketing"
                className={inputClass}
              />
              <AddButton
                type="button"
                size="sm"
                onClick={() => void zalozitKategorii()}
                disabled={kategorieBusy || !novaKategorie.trim()}
                className="shrink-0"
              >
                Přidat
              </AddButton>
            </span>
          )}
        </div>
      </div>

      {/* Vazba na projekt (zadani 8. 9. 2026) - podle ni se doklad ukaze v
          detailu projektu. Nepovinna, rezie se k zadnemu projektu nevaze. */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Projekt</span>
        <ProjectSelect
          value={form.caflouProjectId}
          onChange={(id) => set('caflouProjectId', id)}
          projects={projects}
          className={inputClass}
        />
        {projects.length === 0 && (
          <span className="text-xs text-muted font-body">Projekty se z Caflou nenačetly.</span>
        )}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Částka bez DPH</span>
          <input
            required
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0,00"
            className={`${inputClass} text-right tabular-nums`}
          />
          {/* Kolik to dela s DPH je videt hned pri psani (zadani 8. 9. 2026) -
              na dokladu byva uvedena castka VCETNE, tak at se da zkontrolovat. */}
          <span className="text-xs font-body text-muted text-right tabular-nums">
            {sDph === null ? 's DPH —' : `s DPH ${formatMoney(sDph, form.currency)}`}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">DPH</span>
          <select value={form.vatRate} onChange={(e) => set('vatRate', Number(e.target.value))} className={inputClass}>
            {EXPENSE_VAT_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? 'bez DPH' : `${r} %`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Měna</span>
          <select
            value={form.currency}
            onChange={(e) => set('currency', e.target.value as Currency)}
            className={inputClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_NAMES[c]}
              </option>
            ))}
          </select>
        </label>
        {/* Zpusob uhrady (zadani 10. 9. 2026). Kartou a hotove je zaplaceno uz
            v okamziku vzniku dokladu, tak se rovnou prepne i prepinac vpravo. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Hrazeno</span>
          <select
            value={form.paymentMethod}
            onChange={(e) => {
              const zpusob = e.target.value as PaymentMethod;
              setForm((f) => ({ ...f, paymentMethod: zpusob, paid: zaplacenoRovnou(zpusob) ? true : f.paid }));
            }}
            className={inputClass}
          >
            {ZPUSOBY_UHRADY.map((z) => (
              <option key={z.hodnota} value={z.hodnota}>
                {z.nazev}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <span className="text-sm font-body text-ink">Příloha (PDF nebo foto)</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="text-sm font-body text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-field file:px-3 file:py-2 file:text-sm file:font-heading file:text-ink"
          />
          {fileName && <span className="text-xs text-muted font-body truncate">{fileName}</span>}
        </label>
        {/* Prepinac se dvema stavy misto jednoho tlacitka (zadani 8. 9. 2026)
            - je z nej videt, ktera moznost plati, i bez najeti mysi. */}
        <span className="mb-0.5 inline-flex rounded-lg border border-line overflow-hidden">
          <button
            type="button"
            onClick={() => set('paid', false)}
            aria-pressed={!form.paid}
            className={`font-heading font-semibold text-sm px-4 py-2.5 transition-colors ${
              !form.paid ? 'bg-solidProgress text-white' : 'bg-surface text-muted hover:text-ink'
            }`}
          >
            Neuhrazeno
          </button>
          <button
            type="button"
            onClick={() => set('paid', true)}
            aria-pressed={form.paid}
            className={`font-heading font-semibold text-sm px-4 py-2.5 transition-colors border-l border-line ${
              form.paid ? 'bg-solidDone text-white' : 'bg-surface text-muted hover:text-ink'
            }`}
          >
            Uhrazeno
          </button>
        </span>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {busy ? 'Ukládám…' : 'Uložit doklad'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zavřít
        </button>
        <span className="text-xs text-muted font-body">Po uložení se vrátíte na přehled.</span>
      </div>
    </form>
  );
}

function IkonaFotak() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
