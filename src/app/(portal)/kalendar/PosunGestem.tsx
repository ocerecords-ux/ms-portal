'use client';

import { useEffect, useRef } from 'react';

/**
 * POSUN KALENDÁŘE GESTEM (zadání 20. 9. 2026: „v tom kalendáři by se mělo
 * dát scrollovat doleva i doprava buď prstem v mobilu nebo na počítači Apple
 * myší nebo na touchpadu. Abych nemusel přepínat na šipkách").
 *
 * - Mobil: tah prstem doleva = další týden/den/měsíc, doprava = předchozí.
 * - Mac touchpad / Magic Mouse: vodorovný posun dvěma prsty, stejně.
 *
 * Týden je v mobilu širší než displej a dá se v něm vodorovně posouvat
 * (prvek s `data-vodorovne`). Gesto proto nejdřív doroluje týden ke kraji
 * a teprve tah ZA kraj přepne na další týden - jinak by se nedalo podívat
 * na pátek bez skoku do dalšího týdne.
 *
 * Svislé rolování (hodiny) gesto nechává být: počítá se jen tah, který je
 * jasně víc do strany než nahoru/dolů.
 */
const PRAH_PRST = 60; // px tahu prstem
const PRAH_KOLECKO = 140; // nasčítaný deltaX z touchpadu
const PRODLEVA = 700; // ms po přepnutí, než jde přepnout znovu (setrvačnost touchpadu)

function vodorovnyPosuvnik(cil: EventTarget | null): HTMLElement | null {
  return cil instanceof Element ? (cil.closest('[data-vodorovne]') as HTMLElement | null) : null;
}

/** Je posuvník u kraje ve směru `smer` (1 = doprava/další, -1 = doleva/předchozí)? */
function uKraje(el: HTMLElement | null, smer: -1 | 1): boolean {
  if (!el || el.scrollWidth <= el.clientWidth + 1) return true;
  if (smer === 1) return el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
  return el.scrollLeft <= 2;
}

export function PosunGestem({ onPosun, children }: { onPosun: (smer: -1 | 1) => void; children: React.ReactNode }) {
  const obal = useRef<HTMLDivElement | null>(null);
  const posun = useRef(onPosun);
  posun.current = onPosun;

  useEffect(() => {
    const el = obal.current;
    if (!el) return;
    let zamceno = 0;
    let soucet = 0;
    let vynulovat: number | undefined;
    let start: { x: number; y: number; kraj: { [k: number]: boolean }; cil: HTMLElement | null } | null = null;

    const prepni = (smer: -1 | 1) => {
      const ted = Date.now();
      if (ted < zamceno) return;
      zamceno = ted + PRODLEVA;
      soucet = 0;
      posun.current(smer);
    };

    // --- Touchpad / Magic Mouse ---------------------------------------------
    const kolecko = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2 || e.deltaX === 0) return;
      const smer: -1 | 1 = e.deltaX > 0 ? 1 : -1;
      if (!uKraje(vodorovnyPosuvnik(e.target), smer)) {
        soucet = 0;
        return; // nejdriv se doroluje tyden
      }
      // Zabrani „zpet" v prohlizeci pri tahu dvema prsty.
      e.preventDefault();
      if (Date.now() < zamceno) return;
      if (Math.sign(soucet) !== smer) soucet = 0;
      soucet += e.deltaX;
      window.clearTimeout(vynulovat);
      vynulovat = window.setTimeout(() => (soucet = 0), 250);
      if (Math.abs(soucet) >= PRAH_KOLECKO) prepni(smer);
    };

    // --- Prst ----------------------------------------------------------------
    const dotyk = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      const cil = vodorovnyPosuvnik(e.target);
      // Kraj se bere na ZACATKU tahu - behem nej se tyden roluje sam.
      start = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        kraj: { 1: uKraje(cil, 1), [-1]: uKraje(cil, -1) },
        cil,
      };
    };
    const konec = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const s = start;
      start = null;
      if (Math.abs(dx) < PRAH_PRST || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const smer: -1 | 1 = dx < 0 ? 1 : -1;
      if (s.kraj[smer]) prepni(smer);
    };

    el.addEventListener('wheel', kolecko, { passive: false });
    el.addEventListener('touchstart', dotyk, { passive: true });
    el.addEventListener('touchend', konec, { passive: true });
    return () => {
      el.removeEventListener('wheel', kolecko);
      el.removeEventListener('touchstart', dotyk);
      el.removeEventListener('touchend', konec);
      window.clearTimeout(vynulovat);
    };
  }, []);

  // overscroll-x: contain - tah za okraj neposouva celou stranku ani
  // nespousti „zpet" v Safari.
  return (
    <div ref={obal} className="[overscroll-behavior-x:contain]">
      {children}
    </div>
  );
}
