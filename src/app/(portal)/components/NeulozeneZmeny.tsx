'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * POJISTKA PROTI ZTRÁTĚ ROZDĚLANÉ PRÁCE (zadání 15. 10. 2026: „teď jsme třeba
 * měli vyplněný tracklist a překlikli se a všechno zmizelo… nebo i pojistku,
 * když bude něco předvyplněné, jako chcete uložit?").
 *
 * Formulář řekne „mám neuložené změny" a případně i JAK se uloží. Když potom
 * někdo klikne na odkaz jinam v portálu, portál se zeptá a na jedno kliknutí
 * to uloží - teprve pak odejde. Zavření nebo obnovení stránky hlídá prohlížeč
 * sám (beforeunload).
 *
 * PROČ TO HLÍDÁ OBAL A NE KAŽDÝ FORMULÁŘ ZVLÁŠŤ: odkazů, kterými se dá ze
 * stránky odejít, jsou desítky - horní lišta, dok chatu, odznaky, záložky.
 * Obal poslouchá kliknutí na úrovni celého dokumentu, takže formuláři stačí
 * jediný řádek: `useNeulozeno(zmeneno, uloz)`.
 *
 * Nic nebrání odchodu natvrdo: kdo si práci nechce uložit, dialog zruší
 * a zůstane, nebo odkaz otevře v nové záložce. Portál sám od sebe neukládá -
 * uložení je vždycky rozhodnutí člověka.
 */

type Zaznam = { zmeneno: boolean; uloz?: () => Promise<boolean> };

type Kontext = {
  nahlas: (klic: string, zaznam: Zaznam) => void;
  odhlas: (klic: string) => void;
};

const NeulozenoKontext = createContext<Kontext | null>(null);

/** Je odkaz „obyčejný" - tedy takový, kterým se odchází ze stránky? */
function jeOdchod(odkaz: HTMLAnchorElement, e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false; // nová záložka
  if (odkaz.target && odkaz.target !== '_self') return false;
  if (odkaz.hasAttribute('download')) return false;
  const href = odkaz.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  // Cizí doména ani mailto/tel se neřeší - tam portál stejně nepokračuje.
  try {
    const cil = new URL(odkaz.href, window.location.href);
    if (cil.origin !== window.location.origin) return false;
    if (cil.pathname === window.location.pathname && cil.search === window.location.search) return false;
  } catch {
    return false;
  }
  return true;
}

export function NeulozenoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = usePreklad();
  const zaznamy = useRef(new Map<string, Zaznam>());
  const [neco, setNeco] = useState(false);

  const prepocitej = useCallback(() => {
    let je = false;
    zaznamy.current.forEach((z) => {
      if (z.zmeneno) je = true;
    });
    setNeco(je);
  }, []);

  const nahlas = useCallback(
    (klic: string, zaznam: Zaznam) => {
      zaznamy.current.set(klic, zaznam);
      prepocitej();
    },
    [prepocitej],
  );

  const odhlas = useCallback(
    (klic: string) => {
      zaznamy.current.delete(klic);
      prepocitej();
    },
    [prepocitej],
  );

  // Zavření nebo obnovení stránky - tady se o dialog stará prohlížeč sám.
  useEffect(() => {
    if (!neco) return;
    function pred(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', pred);
    return () => window.removeEventListener('beforeunload', pred);
  }, [neco]);

  // Odchod odkazem uvnitř portálu - na to prohlížeč nestačí, ptáme se sami.
  useEffect(() => {
    if (!neco) return;

    function klik(e: MouseEvent) {
      const cil = e.target as HTMLElement | null;
      const odkaz = cil?.closest?.('a');
      if (!odkaz || !jeOdchod(odkaz as HTMLAnchorElement, e)) return;

      let ulozitelny: (() => Promise<boolean>) | undefined;
      zaznamy.current.forEach((z) => {
        if (z.zmeneno && z.uloz && !ulozitelny) ulozitelny = z.uloz;
      });

      const kam = (odkaz as HTMLAnchorElement).href;

      if (ulozitelny) {
        // Zeptáme se, jestli to má portál uložit. Zrušení = zůstat na místě,
        // ať se rozdělaná práce nedá ztratit jedním uklepnutím.
        if (!window.confirm(t('neulozeno.ulozitAOdejit'))) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        void ulozitelny().then((ok) => {
          if (ok) {
            zaznamy.current.clear();
            setNeco(false);
            router.push(kam.replace(window.location.origin, ''));
          } else {
            window.alert(t('neulozeno.ulozeniSelhalo'));
          }
        });
        return;
      }

      if (!window.confirm(t('neulozeno.opravduOdejit'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener('click', klik, true);
    return () => document.removeEventListener('click', klik, true);
  }, [neco, router, t]);

  return <NeulozenoKontext.Provider value={{ nahlas, odhlas }}>{children}</NeulozenoKontext.Provider>;
}

/**
 * Formulář hlásí, že má rozdělanou práci. `uloz` je nepovinné - když ho
 * formulář dá, portál nabídne uložení jedním kliknutím; bez něj se jen zeptá,
 * jestli má opravdu odejít.
 *
 * Vrací se samo: jakmile se změny uloží (`zmeneno` zhasne) nebo komponenta
 * zmizí ze stránky, hlídání končí.
 */
export function useNeulozeno(zmeneno: boolean, uloz?: () => Promise<boolean>) {
  const kontext = useContext(NeulozenoKontext);
  const klic = useRef(`f${Math.random().toString(36).slice(2)}`);
  const ulozRef = useRef(uloz);
  ulozRef.current = uloz;

  useEffect(() => {
    if (!kontext) return;
    const id = klic.current;
    kontext.nahlas(id, {
      zmeneno,
      uloz: ulozRef.current ? () => ulozRef.current!() : undefined,
    });
    return () => kontext.odhlas(id);
  }, [kontext, zmeneno]);
}
