'use client';

/**
 * STÁHNOUT NÁVOD JAKO PDF (zadání 20. 9. 2026: „dej mi u těch manuálů
 * i možnost ho stáhnout v pdf").
 *
 * PDF se nevyrábí na serveru - návod se tiskne přes prohlížeč a ten nabídne
 * „Uložit jako PDF". Je to o jeden nástroj míň, tisk umí každý prohlížeč
 * i telefon a PDF vyjde vždycky přesně tak, jak návod vypadá (včetně
 * obrázků s čísly). Styly pro tisk jsou v globals.css u třídy `tisk`:
 * vytiskne se jen text návodu, bez lišty, doků a tlačítek.
 */
export function StahnoutPdf({ nazev }: { nazev: string }) {
  function tisk() {
    const puvodni = document.title;
    // Prohlizec pojmenuje soubor podle titulku stranky.
    document.title = nazev.replace(/[\\/:*?"<>|]/g, '-');
    window.print();
    // Safari vraci z print() az po zavreni okna, Chrome hned - titulek se
    // proto vraci az po chvilce, aby se stihl pouzit.
    window.setTimeout(() => {
      document.title = puvodni;
    }, 1500);
  }

  return (
    <button
      type="button"
      onClick={tisk}
      title="Otevře tisk, kde zvolíte Uložit jako PDF"
      className="netisknout inline-flex items-center gap-2 self-start text-sm font-heading font-semibold rounded-pill border border-line text-ink px-4 py-2 hover:border-brand-purple"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3.5v10m0 0 3.5-3.5M12 13.5 8.5 10" />
        <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
      </svg>
      Stáhnout PDF
    </button>
  );
}
