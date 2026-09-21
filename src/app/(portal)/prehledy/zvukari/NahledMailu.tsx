'use client';

import { useEffect, useState } from 'react';

/**
 * NÁHLED MAILU VPRAVO (zadání 21. 9. 2026: „ten náhled mailu mi dej někde
 * rovnou na pravou část obrazovky").
 *
 * Ukazuje mail zvukaře, na kterého se klikne v seznamu (bez výběru prvního
 * v měsíci), a mění se hned při úpravě nastavení - ještě před uložením.
 * Obě části stránky spolu mluví událostí v okně, ať nemusí být jedna
 * velká klientská komponenta.
 */
export const UDALOST_NAHLEDU = 'ms-nahled-prehledu';

export type NastaveniNahledu = {
  den: number;
  castky: boolean;
  druhy: boolean;
  projekty: boolean;
  bonusy: boolean;
  poznamka: string;
};

export type ZmenaNahledu = { user?: string; nastaveni?: NastaveniNahledu; neulozene?: boolean };

export function zmenNahled(zmena: ZmenaNahledu) {
  window.dispatchEvent(new CustomEvent<ZmenaNahledu>(UDALOST_NAHLEDU, { detail: zmena }));
}

export function NahledMailu({
  mesic,
  prvni,
  jmena,
}: {
  mesic: string;
  prvni: string | null;
  jmena: Record<string, string>;
}) {
  const [user, setUser] = useState<string | null>(prvni);
  const [nastaveni, setNastaveni] = useState<NastaveniNahledu | null>(null);
  const [neulozene, setNeulozene] = useState(false);
  const [src, setSrc] = useState('');

  useEffect(() => {
    const posluchac = (e: Event) => {
      const z = (e as CustomEvent<ZmenaNahledu>).detail;
      if (z.user !== undefined) setUser(z.user);
      if (z.nastaveni) setNastaveni(z.nastaveni);
      if (z.neulozene !== undefined) setNeulozene(z.neulozene);
    };
    window.addEventListener(UDALOST_NAHLEDU, posluchac);
    return () => window.removeEventListener(UDALOST_NAHLEDU, posluchac);
  }, []);

  useEffect(() => {
    setUser(prvni);
  }, [prvni, mesic]);

  // Při psaní vzkazu se náhled nepřenačítá po každém písmenu.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams({ mesic });
      if (user) q.set('user', user);
      if (nastaveni) {
        q.set('den', String(nastaveni.den));
        q.set('castky', nastaveni.castky ? '1' : '0');
        q.set('druhy', nastaveni.druhy ? '1' : '0');
        q.set('projekty', nastaveni.projekty ? '1' : '0');
        q.set('bonusy', nastaveni.bonusy ? '1' : '0');
        q.set('poznamka', nastaveni.poznamka);
      }
      setSrc(`/api/admin/vykazy/nahled-mesicni?${q.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [mesic, user, nastaveni]);

  return (
    <section className="bg-surface border border-line rounded-card shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
        <span className="font-heading font-semibold text-sm text-muted uppercase tracking-wide">Náhled mailu</span>
        <span className="text-xs font-body text-muted truncate">
          {user && jmena[user] ? jmena[user] : 'ukázka'}
          {neulozene ? ' · neuložené nastavení' : ''}
        </span>
        {src && (
          <a href={src} target="_blank" rel="noreferrer" className="text-xs font-heading font-semibold text-brand-purple no-underline shrink-0">
            Otevřít ↗
          </a>
        )}
      </div>
      {src && <iframe title="Náhled mailu" src={src} className="w-full h-[70vh] lg:h-[calc(100vh-190px)] bg-white border-0" />}
    </section>
  );
}

/** Tlačítko v řádku zvukaře - přepne náhled na něj. */
export function UkazatNahled({ user }: { user: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        zmenNahled({ user });
      }}
      className="text-xs font-heading font-semibold text-brand-purple bg-transparent border-0 cursor-pointer"
    >
      Náhled mailu →
    </button>
  );
}
