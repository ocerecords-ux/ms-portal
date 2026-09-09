import type { Config } from 'tailwindcss';

/**
 * Design tokeny vytazene ze skutecneho webu msportal.cz (viz README > Design
 * system), od 9. 9. 2026 s podporou tmaveho rezimu.
 *
 * JAK TO FUNGUJE
 * Barvy, ktere se v tmavem rezimu meni, nejsou zapsane primo tady, ale jako
 * promenne v globals.css (:root pro svetly rezim, .dark pro tmavy). Tailwind
 * si je bere pres rgb(var(--x) / <alpha-value>), takze i pak funguji zapisy
 * s pruhlednosti jako text-muted/60 nebo bg-line/70.
 *
 * Znacka se nemeni: fialova a zelena jsou v obou rezimech stejne, protoze
 * horni lista, hlavicky tabulek i levy panel zustavaji fialove (rozhodnuti
 * uzivatele 9. 9. 2026). V tmavem rezimu tedy ztmavne podklad, karty a text,
 * ale portal je porad na prvni pohled Mediaspace.
 */
const promenna = (jmeno: string) => `rgb(var(${jmeno}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // Tmavy rezim se prepina tridou .dark na <html>, ne podle systemu - portal
  // si volbu pamatuje sam (viz ThemeToggle a skript v layout.tsx).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Znacka - stejna v obou rezimech.
        brand: {
          purple: '#7B55FF',
          purpleDeep: '#6B2AF0',
          purpleDark: '#4B2FB0',
          // Svetla fialova pro zvyrazneni na tmavem i fialovem podkladu -
          // pouziva ji serazeny sloupec v tabulkach (zadani 9. 9. 2026:
          // "udelal bych to vsude fialove, at to tolik nerve") a fialovy text
          // v tmavem rezimu. Sytou #7B55FF by na obou podkladech nebylo videt.
          purpleLight: '#B49BFF',
          green: '#1FDF67',
          greenDeep: '#149E4B',
        },
        // Tmavy pruh (hlavicky tabulek, inverzni tlacitka). Drive se na nej
        // pouzival token "ink", jenze ten je barva TEXTU - v tmavem rezimu
        // zesvetla, takze z hlavicek byly bile pruhy s bilym pismem (zprava
        // uzivatele 9. 9. 2026: "u firem, uzivatelu, dokladu jede vrchni lista
        // bila a je to necitelne"). Tmavy pruh musi zustat tmavy v obou
        // rezimech, proto ma vlastni promennou.
        bar: promenna('--c-bar'),
        // Tmavy text na svetlych plochach znacky (zelena tlacitka a odznaky).
        // Pevna barva - "ink" by se v tmavem rezimu prevratil a zelena
        // zustava svetla, takze by na ni bylo svetle pismo.
        onAccent: '#201A33',
        // Plne obarvene stavove odznaky. Take pevne: bg-status-* se v tmavem
        // rezimu rozsvecuje kvuli citelnosti TEXTU, coz se pro plochu pod
        // bilym pismem nehodi.
        solidDone: '#149E4B',
        solidProgress: '#E08A00',
        // Plochy a text - meni se s rezimem.
        ink: promenna('--c-ink'),
        paper: promenna('--c-paper'),
        surface: promenna('--c-surface'),
        surfaceSoft: promenna('--c-surface-soft'),
        field: promenna('--c-field'),
        line: promenna('--c-line'),
        muted: promenna('--c-muted'),
        tint: promenna('--c-tint'),
        okTint: promenna('--c-ok-tint'),
        warnTint: promenna('--c-warn-tint'),
        dangerTint: promenna('--c-danger-tint'),
        danger: promenna('--c-danger'),
        status: {
          new: promenna('--c-status-new'),
          progress: promenna('--c-status-progress'),
          done: promenna('--c-status-done'),
        },
      },
      borderRadius: {
        card: '16px',
        pill: '999px',
      },
      // Firemni font je Acid Grotesk (zadani 9. 9. 2026). Vsechny tri rodiny
      // jim zacinaji, Inter / Jost / Poppins zustavaji jako zaloha pro pripad,
      // ze font neni k dispozici - viz @font-face v globals.css.
      fontFamily: {
        heading: ['Acid Grotesk', 'var(--font-inter)', 'Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Acid Grotesk', 'var(--font-jost)', 'Jost', 'Futura', 'sans-serif'],
        body: ['Acid Grotesk', 'var(--font-poppins)', 'Poppins', 'Avenir', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
