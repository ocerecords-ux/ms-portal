'use client';

import { useState } from 'react';
import { CountrySelect } from '@/app/(admin)/admin/CountrySelect';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { HEREC_STUDIOS } from '@/lib/roles';

/**
 * Formulář, kterým herec doplní své údaje po prvním přihlášení
 * (zadání 16. 9. 2026).
 *
 * VYPLŇUJE SE ČASTO Z TELEFONU — jedno pole pod druhým, velká písmena
 * a žádné rozbalovací bludiště. Povinné je jen jméno; zbytek se dá doplnit
 * i později v Mém účtu, protože zavřená brána na začátku je horší než
 * chybějící PSČ.
 */
type Udaje = {
  name: string;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  addressCountry: string;
  bankAccount: string;
  studioLocations: string[];
  vatPayer: boolean;
};

export function DoplneniUdaju({ vychozi }: { vychozi: Udaje }) {
  const [u, setU] = useState<Udaje>({
    ...vychozi,
    addressCountry: vychozi.addressCountry || DEFAULT_COUNTRY,
  });
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const nastav = <K extends keyof Udaje>(klic: K, hodnota: Udaje[K]) =>
    setU((p) => ({ ...p, [klic]: hodnota }));

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    if (bezi) return;
    if (!u.name.trim()) {
      setChyba('Vyplňte prosím jméno a příjmení.');
      return;
    }
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/doplnit-udaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(u),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložení se nepodařilo. Zkuste to prosím znovu.');
        return;
      }
      // Tvrdé načtení, ne router.push: portál si při něm znovu přečte účet
      // a brána na doplnění údajů už herce nikam neodešle.
      window.location.href = '/projekty';
    } catch {
      setChyba('Uložení se nepodařilo. Zkuste to prosím znovu.');
    } finally {
      setBezi(false);
    }
  }

  return (
    <form onSubmit={odesli} className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-heading text-muted uppercase tracking-wide m-0">Vítejte v portálu</p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink m-0 mt-1">Doplňte prosím své údaje</h1>
        <p className="text-muted text-sm mt-2 font-body m-0">
          Potřebujeme je do smlouvy a k výplatě honoráře. Je to na dvě minuty a pak už vás portál
          nechá na pokoji.
        </p>
      </div>

      <Pole popisek="Jméno a příjmení">
        <input
          value={u.name}
          onChange={(e) => nastav('name', e.target.value)}
          autoComplete="name"
          className="admin-input"
        />
      </Pole>

      <Pole popisek="Ulice a č. p.">
        <input
          value={u.addressStreet}
          onChange={(e) => nastav('addressStreet', e.target.value)}
          autoComplete="street-address"
          className="admin-input"
        />
      </Pole>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <Pole popisek="Město">
            <input
              value={u.addressCity}
              onChange={(e) => nastav('addressCity', e.target.value)}
              autoComplete="address-level2"
              className="admin-input"
            />
          </Pole>
        </div>
        <div className="w-32">
          <Pole popisek="PSČ">
            <input
              value={u.addressZip}
              onChange={(e) => nastav('addressZip', e.target.value)}
              autoComplete="postal-code"
              inputMode="numeric"
              className="admin-input"
            />
          </Pole>
        </div>
      </div>

      <Pole popisek="Země">
        <CountrySelect value={u.addressCountry} onChange={(kod) => nastav('addressCountry', kod)} />
      </Pole>

      <Pole popisek="Číslo účtu">
        <input
          value={u.bankAccount}
          onChange={(e) => nastav('bankAccount', e.target.value)}
          placeholder="123456789/0800"
          className="admin-input"
        />
      </Pole>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-heading font-semibold text-ink">Kde můžete natáčet</span>
        <div className="flex flex-col gap-1.5">
          {HEREC_STUDIOS.map((studio) => (
            <label key={studio} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={u.studioLocations.includes(studio)}
                onChange={(e) =>
                  nastav(
                    'studioLocations',
                    e.target.checked
                      ? [...u.studioLocations, studio]
                      : u.studioLocations.filter((s) => s !== studio),
                  )
                }
                className="w-4 h-4 accent-brand-purple"
              />
              <span className="text-sm font-body text-ink">{studio}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={u.vatPayer}
          onChange={(e) => nastav('vatPayer', e.target.checked)}
          className="w-4 h-4 accent-brand-purple"
        />
        <span className="text-sm font-heading font-semibold text-ink">Jsem plátce DPH</span>
      </label>

      <p className="text-xs font-body text-muted m-0">
        Údaje použijeme jen k uzavření smlouvy, vyplacení honoráře a k plnění zákonných povinností.
        Nikomu dalšímu je nedáváme a kdykoliv si je můžete změnit v Mém účtu.
      </p>

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}

      <button
        type="submit"
        disabled={bezi}
        className="self-start text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-6 py-3 disabled:opacity-60"
      >
        {bezi ? 'Ukládám…' : 'Uložit a pokračovat do portálu'}
      </button>
    </form>
  );
}

function Pole({ popisek, children }: { popisek: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-heading font-semibold text-ink">{popisek}</span>
      {children}
    </label>
  );
}
