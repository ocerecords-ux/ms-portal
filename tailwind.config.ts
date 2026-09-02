import type { Config } from 'tailwindcss';

// Design tokeny vytazene ze skutecneho webu msportal.cz (viz README > Design system).
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7B55FF',
          purpleDeep: '#6B2AF0',
          purpleDark: '#4B2FB0',
          green: '#1FDF67',
          greenDeep: '#149E4B',
        },
        ink: '#201A33',
        paper: '#FBFAFF',
        field: '#F6F6F6',
        line: '#E4DFFB',
        muted: '#6E6580',
        status: {
          new: '#7B55FF',
          progress: '#E08A00',
          done: '#149E4B',
        },
      },
      fontFamily: {
        heading: ['var(--font-inter)', 'Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['var(--font-jost)', 'Jost', 'Futura', 'sans-serif'],
        body: ['var(--font-poppins)', 'Poppins', 'Avenir', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};

export default config;
