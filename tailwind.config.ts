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
          green: '#1FDF67',
          greenDeep: '#149E4B',
        },
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
