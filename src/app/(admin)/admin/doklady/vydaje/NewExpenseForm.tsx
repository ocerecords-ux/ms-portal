'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { Currency, PaymentMethod } from '@prisma/client';
import { CURRENCIES, CURRENCY_NAMES, formatMoney, minorToInput, parseMoneyToMinor } from '@/lib/doklady';
import { EXPENSE_VAT_RATES, expenseTotalMinor } from '@/lib/expenses';
import { MAX_FOTKA_BYTES, ZPUSOBY_UHRADY, zaplacenoRovnou, type PrectenaUctenka } from '@/lib/uctenka';
import { ProjectSelect, type ProjectChoice } from '../ProjectSelect';
import { KOTVA_NOVE, useOtevriZeZkratky } from '@/lib/zkratky';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';

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
  vychoziProjekt,
}: {
  categories: { id: string; name: string }[];
  issuers: { id: string; name: string; isDefault: boolean; currency: Currency }[];
  projects: ProjectChoice[];
  /** Projekt z adresy (?projekt=) - výdaj založený z detailu projektu (21. 9. 2026). */
  vychoziProjekt?: string | null;
}) {
  const router = useRouter();
  const defaultIssuer = issuers.find((i) => i.isDefault) ?? issuers[0];
  const fotoRef = useRef<HTMLInputElement>(null);
  const souborRef = useRef<HTMLInputElement>(null);

  // Z detailu projektu se sem chodi rovnou zakladat - formular je pak otevreny.
  const [open, setOpen] = useState(Boolean(vychoziProjekt));

  // Prisel sem clovek pres rychlou volbu z leveho panelu? Pak rovnou
  // rozbalit - zkratka ma vest do editacniho okna, ne jen na stranku
  // (zadani 9. 9. 2026).
  useOtevriZeZkratky(() => setOpen(true));
  const [form, setForm] = useState({
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    number: '',
    categoryId: categories[0]?.id ?? '',
    caflouProjectId: vychoziProjekt ?? '',
    issuerCompanyId: defaultIssuer?.id ?? '',
    currency: (defaultIssuer?.currency ?? 'CZK') as Currency,
    description: '',
    amount: '',
    vatRate: 21,
    paid: false,
    paymentMethod: 'TRANSFER' as PaymentMethod,
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PŘÍLOHY NA JEDNOM MÍSTĚ (zadání 21. 9. 2026: „při vkládání dokladu se
  // tady dubluje vkládání příloh, chtělo by to sjednotit"). Dřív byl nahoře
  // „Vybrat doklad" (přečetl se) a dole ještě „Příloha" - a nebylo jasné,
  // co kam. Teď je jen seznam souborů: první je doklad, ze kterého se čtou
  // údaje a ukazuje se v náhledu, další jsou přílohy navíc.
  const [soubory, setSoubory] = useState<File[]>([]);
  const [cteni, setCteni] = useState(false);
  const [cteniZprava, setCteniZprava] = useState<string | null>(null);

  /**
   * FOŤÁK JEN NA TELEFONU (zadání 16. 9. 2026: „ve výdajích na počítači by
   * měla být jen možnost vybrat přílohu, ne vyfotit. Ale mělo by to mít
   * stejnou funkci — rozpoznat údaje z účtenky").
   *
   * Na počítači nemá „Vyfotit doklad" co otevřít — atribut capture tam stejně
   * jen vyvolá obyčejný výběr souboru, takže tlačítko slibovalo něco, co se
   * nestane. Čtení dokladu zůstává u obojího stejné.
   *
   * Pozná se to podle toho, čím člověk ukazuje: hrubý ukazatel (prst) =
   * telefon nebo tablet. Šířka okna by lhala u zmenšeného okna na notebooku.
   */
  const [jeDotykovy, setJeDotykovy] = useState(false);
  useEffect(() => {
    setJeDotykovy(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  /**
   * ČÁSTKA SE DÁ ZADAT I S DPH (zadání 16. 9. 2026: „to pole částka bez DPH
   * otočit nějakýma šipkama, abych přehodil a naopak vkládal částku s DPH").
   *
   * Na účtence bývá velkým písmem jen částka VČETNE daně, takže ji člověk
   * musel před opsáním v hlavě dělit. Ukládá se pořád částka bez DPH -
   * přepínač mění jen to, co se píše do políčka.
   */
  const [zadavamSDph, setZadavamSDph] = useState(false);

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

  /** Přidá vybrané soubory. Když zatím žádný nebyl, první se přečte. */
  function pridejSoubory(nove: File[]) {
    if (nove.length === 0) return;
    const bylPrazdny = soubory.length === 0;
    setSoubory((s) => [...s, ...nove]);
    setError(null);
    if (bylPrazdny) void nactiZFotky(nove[0]);
  }

  function odeberSoubor(index: number) {
    setSoubory((s) => s.filter((_, i) => i !== index));
    if (index === 0) setCteniZprava(null);
  }

  async function nactiZFotky(soubor: File) {
    // PDF se čte stejně jako fotka (21. 9. 2026: „aby uměl číst údaje i z pdf").
    if (soubor.size > MAX_FOTKA_BYTES) {
      setCteniZprava('Soubor je moc velký na přečtení, údaje vyplňte ručně.');
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
          : 'Údaje jsou z dokladu — zkontrolujte je a uložte.',
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
      // Uklada se castka BEZ DPH, at clovek psal cokoliv (zadani 16. 9. 2026).
      body.set('amount', zadavamSDph ? naVstup(bezDph ?? 0) : form.amount);
      body.set('vatRate', String(form.vatRate));
      body.set('paid', form.paid ? 'true' : 'false');
      body.set('paymentMethod', form.paymentMethod);
      if (form.note) body.set('note', form.note);
      // Prvni soubor je doklad, zbytek dalsi prilohy.
      soubory.forEach((soubor, i) => body.append(i === 0 ? 'attachment' : 'dalsi', soubor));

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
      setSoubory([]);
      setCteniZprava(null);
      if (fotoRef.current) fotoRef.current.value = '';
      if (souborRef.current) souborRef.current.value = '';
      setOpen(false);
      router.refresh();
    } catch {
      setError('Doklad se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Co je v políčku a co z toho vyjde. `form.amount` drží TO, CO ČLOVĚK PÍŠE -
   * podle přepínače je to částka bez DPH, nebo s DPH. Ukládá se vždycky ta
   * bez DPH (viz submit).
   */
  const napsano = form.amount.trim() ? parseMoneyToMinor(form.amount) : null;
  const bezDph = napsano === null ? null : zadavamSDph ? naBezDph(napsano, form.vatRate) : napsano;
  const sDph = bezDph === null ? null : expenseTotalMinor(bezDph, form.vatRate);
  /** Druhá částka pod políčkem - vždycky ta, kterou člověk zrovna nepíše. */
  const protejsek = zadavamSDph ? bezDph : sDph;

  /** Přehození pole. Co je napsané, se přepočítá, ať číslo pořád platí. */
  function prehodDph() {
    const nove = !zadavamSDph;
    if (napsano !== null) {
      const prepocet = nove ? expenseTotalMinor(bezDph ?? 0, form.vatRate) : (bezDph ?? 0);
      set('amount', naVstup(prepocet));
    }
    setZadavamSDph(nove);
  }

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

      {/* Doklad se přečte sám (zadání 10. 9. 2026). NA TELEFONU foťákem, NA
          POČÍTAČI výběrem souboru (zadání 16. 9. 2026: „na počítači by měla
          být jen možnost vybrat přílohu, ne vyfotit. Ale mělo by to mít
          stejnou funkci"). Čtení je v obou případech totéž - liší se jen to,
          odkud se obrázek vezme, a proto i popisek. */}
      <div className="flex flex-col gap-3 bg-tint border border-line rounded-lg px-4 py-3">
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            pridejSoubory(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <input
          ref={souborRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            pridejSoubory(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => (jeDotykovy && soubory.length === 0 ? fotoRef : souborRef).current?.click()}
            disabled={cteni}
            className="inline-flex items-center gap-2 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            {jeDotykovy && soubory.length === 0 ? <IkonaFotak /> : <IkonaSoubor />}
            {cteni
              ? 'Čtu doklad…'
              : soubory.length > 0
                ? 'Přidat další přílohu'
                : jeDotykovy
                  ? 'Vyfotit doklad'
                  : 'Vybrat doklad'}
          </button>
          {jeDotykovy && soubory.length === 0 && (
            <button
              type="button"
              onClick={() => souborRef.current?.click()}
              className="text-sm font-heading font-semibold text-brand-purple bg-transparent border-0"
            >
              nebo vybrat soubor / PDF
            </button>
          )}
          <span className="text-xs font-body text-muted flex-1 min-w-[200px]">
            {cteniZprava ??
              (soubory.length > 0
                ? 'Další soubory se jen přiloží.'
                : 'Vyberte PDF, sken nebo fotku dokladu (klidně víc souborů) - částku, datum i DPH doplním za vás. Před uložením to zkontrolujte.')}
          </span>
        </div>
        {soubory.length > 0 && (
          <ul className="list-none m-0 p-0 flex flex-col gap-1">
            {soubory.map((soubor, i) => (
              <li key={`${soubor.name}-${i}`} className="flex items-center gap-2 text-sm font-body text-ink min-w-0">
                <span className="text-xs font-heading text-muted shrink-0">{i === 0 ? 'Doklad' : 'Příloha'}</span>
                <span className="truncate">{soubor.name}</span>
                <button
                  type="button"
                  onClick={() => odeberSoubor(i)}
                  aria-label={`Odebrat ${soubor.name}`}
                  className="text-muted hover:text-danger bg-transparent border-0 px-1 leading-none"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
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
          <DatumPole
            required
            value={form.issueDate}
            onChange={(e) => set('issueDate', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Splatnost</span>
          <DatumPole value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputClass} />
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
            <VyberPole value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
              <option value="">— bez kategorie —</option>
              {kategorie.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </VyberPole>
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
        <div className="flex flex-col gap-1.5">
          {/* ŠIPKY PŘEHODÍ, CO SE PÍŠE (zadání 16. 9. 2026). Na účtence bývá
              velkým písmem částka VČETNE daně; tohle ji nechá opsat tak, jak
              tam stojí. Uloží se pořád částka bez DPH. */}
          <span className="flex items-center gap-2">
            <span className="text-sm font-body text-ink">
              {zadavamSDph ? 'Částka s DPH' : 'Částka bez DPH'}
            </span>
            <button
              type="button"
              onClick={prehodDph}
              title={
                zadavamSDph
                  ? 'Přepnout na zadávání částky bez DPH'
                  : 'Přepnout na zadávání částky s DPH'
              }
              aria-label={
                zadavamSDph
                  ? 'Přepnout na zadávání částky bez DPH'
                  : 'Přepnout na zadávání částky s DPH'
              }
              className="text-muted hover:text-brand-purple transition-colors leading-none"
            >
              <IkonaPrehodit />
            </button>
          </span>
          <label className="flex flex-col gap-1.5">
            <input
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0,00"
              className={`${inputClass} text-right tabular-nums`}
            />
            {/* Druha castka je videt hned pri psani (zadani 8. 9. 2026) - at
                se da zkontrolovat proti dokladu. */}
            <span className="text-xs font-body text-muted text-right tabular-nums">
              {protejsek === null
                ? zadavamSDph
                  ? 'bez DPH —'
                  : 's DPH —'
                : `${zadavamSDph ? 'bez DPH' : 's DPH'} ${formatMoney(protejsek, form.currency)}`}
            </span>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">DPH</span>
          <VyberPole value={form.vatRate} onChange={(e) => set('vatRate', Number(e.target.value))} className={inputClass}>
            {EXPENSE_VAT_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? 'bez DPH' : `${r} %`}
              </option>
            ))}
          </VyberPole>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Měna</span>
          <VyberPole
            value={form.currency}
            onChange={(e) => set('currency', e.target.value as Currency)}
            className={inputClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_NAMES[c]}
              </option>
            ))}
          </VyberPole>
        </label>
        {/* Zpusob uhrady (zadani 10. 9. 2026). Kartou a hotove je zaplaceno uz
            v okamziku vzniku dokladu, tak se rovnou prepne i prepinac vpravo. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Hrazeno</span>
          <VyberPole
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
          </VyberPole>
        </label>
      </div>

      <div className="flex items-end gap-4 flex-wrap justify-end">
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

/** Soubor - na počítači se doklad vybírá, nefotí (zadání 16. 9. 2026). */
function IkonaSoubor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

/** Dvě šipky nad sebou - přehození částky bez DPH / s DPH (zadání 16. 9. 2026). */
function IkonaPrehodit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M7 4v16" />
      <path d="M4 7l3-3 3 3" />
      <path d="M17 20V4" />
      <path d="M20 17l-3 3-3-3" />
    </svg>
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

/**
 * Z částky S DPH zpátky na částku bez DPH (zadání 16. 9. 2026).
 *
 * Zaokrouhluje se na haléře, takže zpětný převod nemusí dát přesně to samé
 * číslo, ze kterého se vyšlo - u 21 % to hraje o haléř. Doklad se ukládá
 * v částce bez DPH, tak ať je zaokrouhlení vidět hned pod políčkem.
 */
function naBezDph(sDphMinor: number, vatRate: number): number {
  if (!vatRate) return sDphMinor;
  return Math.round((sDphMinor * 100) / (100 + vatRate));
}

/** Haléře do tvaru, v jakém se píšou do políčka: „826,45". */
function naVstup(minor: number): string {
  return (minor / 100).toFixed(2).replace('.', ',');
}
