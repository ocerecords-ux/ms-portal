'use client';

import { useState } from 'react';
import { CountrySelect } from '@/app/(admin)/admin/CountrySelect';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { HEREC_STUDIOS } from '@/lib/roles';
import type { PolePozvanky } from '@/lib/pozvankaUdaju';

/**
 * Formulář, do kterého herec nebo firma vyplní své údaje (zadání 16. 9. 2026).
 *
 * VYPLŇUJE SE ČASTO Z TELEFONU, cestou ze studia — proto jedno pole pod druhým,
 * velká písmena, žádné rozbalovací bludiště a žádná povinná pole navíc.
 * Povinné je jen to, bez čeho by záznam nedával smysl.
 *
 * U FIRMY SE ZAČÍNÁ IČEM. Zbytek si portál stáhne z obchodního rejstříku sám -
 * opisovat adresu sídla z výpisu je práce, kterou za člověka umí udělat stroj.
 */
export function FormularUdaju({
  token,
  druh,
  pole,
  vychozi,
  poznamka,
}: {
  token: string;
  druh: 'HEREC' | 'FIRMA';
  pole: PolePozvanky[];
  vychozi: Record<string, string | boolean | string[]>;
  poznamka: string | null;
}) {
  const [hodnoty, setHodnoty] = useState<Record<string, string | boolean | string[]>>({
    addressCountry: DEFAULT_COUNTRY,
    ...vychozi,
  });
  const [vzkaz, setVzkaz] = useState('');
  const [odesilam, setOdesilam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState(false);
  const [aresBezi, setAresBezi] = useState(false);
  const [aresChyba, setAresChyba] = useState<string | null>(null);

  const nastav = (klic: string, hodnota: string | boolean | string[]) =>
    setHodnoty((p) => ({ ...p, [klic]: hodnota }));

  async function nactiZAresu() {
    const ico = String(hodnoty.ic ?? '').replace(/\D/g, '');
    if (ico.length !== 8) {
      setAresChyba('IČ má osm číslic.');
      return;
    }
    setAresBezi(true);
    setAresChyba(null);
    try {
      const res = await fetch(`/api/udaje/${encodeURIComponent(token)}/ares?ico=${ico}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAresChyba(data?.error || 'Registr se nepodařilo zeptat.');
        return;
      }
      // Co registr nevi, se nepřepisuje - jinak by se smazalo, co uz clovek napsal.
      setHodnoty((p) => ({
        ...p,
        name: data.name || p.name || '',
        ic: data.ic || p.ic || '',
        dic: data.dic || p.dic || '',
        vatPayer: Boolean(data.vatPayer),
        addressStreet: data.addressStreet || p.addressStreet || '',
        addressCity: data.addressCity || p.addressCity || '',
        addressZip: data.addressZip || p.addressZip || '',
        addressCountry: data.addressCountry || p.addressCountry || DEFAULT_COUNTRY,
      }));
    } catch {
      setAresChyba('Registr se nepodařilo zeptat.');
    } finally {
      setAresBezi(false);
    }
  }

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    if (odesilam) return;
    // Bez jmena a kontaktu by zaznam nedaval smysl; zbytek je na cloveku.
    const jmeno = String(hodnoty.name ?? '').trim();
    const kontakt = String(hodnoty[druh === 'HEREC' ? 'email' : 'contactEmail'] ?? '').trim();
    if (!jmeno) {
      setChyba(druh === 'HEREC' ? 'Vyplňte prosím jméno.' : 'Vyplňte prosím název firmy.');
      return;
    }
    if (!kontakt) {
      setChyba('Vyplňte prosím e-mail — bez něj vám nemáme kam odpovědět.');
      return;
    }

    setOdesilam(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/udaje/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ udaje: hodnoty, vzkaz: vzkaz.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Odeslání se nepodařilo. Zkuste to prosím znovu.');
        return;
      }
      setHotovo(true);
    } catch {
      setChyba('Odeslání se nepodařilo. Zkuste to prosím znovu.');
    } finally {
      setOdesilam(false);
    }
  }

  if (hotovo) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Děkujeme, máme to</h1>
        <p className="text-muted font-body mt-3 m-0">
          Údaje jsme dostali. Kdyby k nim bylo potřeba cokoliv doplnit, ozveme se.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={odesli} className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">
          {druh === 'HEREC' ? 'Údaje herce' : 'Fakturační údaje'}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">Vyplňte prosím své údaje</h1>
        <p className="text-muted text-sm mt-2 font-body m-0">
          {druh === 'HEREC'
            ? 'Potřebujeme je do smlouvy a k výplatě honoráře. Přihlašovat se nemusíte.'
            : 'Stačí zadat IČ a zbytek se doplní z obchodního rejstříku. Přihlašovat se nemusíte.'}
        </p>
        {poznamka && <p className="text-sm font-body text-ink mt-3 m-0">{poznamka}</p>}
      </div>

      {druh === 'FIRMA' && (
        <div className="bg-surface border border-line rounded-card p-4 flex flex-col gap-2">
          <label className="text-sm font-heading font-semibold text-ink">Načíst z rejstříku</label>
          <div className="flex gap-2 flex-wrap">
            <input
              value={String(hodnoty.ic ?? '')}
              onChange={(e) => nastav('ic', e.target.value)}
              inputMode="numeric"
              placeholder="IČ (8 číslic)"
              className="admin-input flex-1 min-w-[140px]"
            />
            <button
              type="button"
              onClick={() => void nactiZAresu()}
              disabled={aresBezi}
              className="text-sm font-heading font-semibold rounded-lg border border-brand-purple text-brand-purple px-4 py-2 disabled:opacity-60"
            >
              {aresBezi ? 'Hledám…' : 'Načíst z ARESu'}
            </button>
          </div>
          {aresChyba && <p className="text-sm font-body text-danger m-0">{aresChyba}</p>}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {pole.map((p) => (
          <Pole key={p.klic} pole={p} hodnota={hodnoty[p.klic]} nastav={nastav} />
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-heading font-semibold text-ink">Vzkaz pro nás (nepovinné)</span>
        <textarea
          value={vzkaz}
          onChange={(e) => setVzkaz(e.target.value)}
          rows={3}
          className="admin-input"
          placeholder="Cokoliv, co bychom měli vědět."
        />
      </label>

      <p className="text-xs font-body text-muted m-0">
        Údaje použijeme jen k uzavření smlouvy, vyplacení honoráře a k plnění zákonných povinností.
        Nikomu dalšímu je nedáváme.
      </p>

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}

      <button
        type="submit"
        disabled={odesilam}
        className="self-start text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-6 py-3 disabled:opacity-60"
      >
        {odesilam ? 'Odesílám…' : 'Odeslat údaje'}
      </button>
    </form>
  );
}

function Pole({
  pole,
  hodnota,
  nastav,
}: {
  pole: PolePozvanky;
  hodnota: string | boolean | string[] | undefined;
  nastav: (klic: string, hodnota: string | boolean | string[]) => void;
}) {
  if (pole.typ === 'ano-ne') {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={hodnota === true}
          onChange={(e) => nastav(pole.klic, e.target.checked)}
          className="w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-heading font-semibold text-ink">{pole.popisek}</span>
      </label>
    );
  }

  if (pole.typ === 'zeme') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-heading font-semibold text-ink">{pole.popisek}</span>
        <CountrySelect
          value={typeof hodnota === 'string' ? hodnota : DEFAULT_COUNTRY}
          onChange={(kod) => nastav(pole.klic, kod)}
        />
      </div>
    );
  }

  if (pole.typ === 'studia') {
    const vybrano = Array.isArray(hodnota) ? hodnota : [];
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-heading font-semibold text-ink">{pole.popisek}</span>
        <div className="flex flex-col gap-1.5">
          {HEREC_STUDIOS.map((studio) => (
            <label key={studio} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={vybrano.includes(studio)}
                onChange={(e) =>
                  nastav(
                    pole.klic,
                    e.target.checked ? [...vybrano, studio] : vybrano.filter((s) => s !== studio),
                  )
                }
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">{studio}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-heading font-semibold text-ink">{pole.popisek}</span>
      <input
        type={pole.typ === 'datum' ? 'date' : 'text'}
        value={typeof hodnota === 'string' ? hodnota : ''}
        onChange={(e) => nastav(pole.klic, e.target.value)}
        className="admin-input"
        inputMode={pole.klic === 'phone' || pole.klic === 'addressZip' ? 'numeric' : undefined}
        autoComplete={autoVyplneni(pole.klic)}
      />
    </label>
  );
}

/** Ať telefon nabídne, co o svém majiteli ví — méně psaní na malé klávesnici. */
function autoVyplneni(klic: string): string | undefined {
  switch (klic) {
    case 'name': return 'name';
    case 'email':
    case 'contactEmail': return 'email';
    case 'phone':
    case 'contactPhone': return 'tel';
    case 'addressStreet': return 'street-address';
    case 'addressCity': return 'address-level2';
    case 'addressZip': return 'postal-code';
    default: return undefined;
  }
}
