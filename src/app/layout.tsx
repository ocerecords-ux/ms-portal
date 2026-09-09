import type { Metadata } from 'next';
import { Inter, Jost, Poppins } from 'next/font/google';
import './globals.css';
import { SKRIPT_MOTIVU } from '@/lib/motiv';

// Nahrada za puvodni Wix fonty (Helvetica Neue / Futura / Avenir),
// viz README > Design system pro zduvodneni vyberu.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', weight: ['500', '600', '700', '800'] });
const jost = Jost({ subsets: ['latin', 'latin-ext'], variable: '--font-jost', weight: ['400', '500', '600'] });
const poppins = Poppins({ subsets: ['latin', 'latin-ext'], variable: '--font-poppins', weight: ['300', '400', '500', '600'] });

// Ikona na zalozce prohlizece (zadani 8. 9. 2026). Soubory icon.svg,
// favicon.ico a apple-icon.png lezi primo v src/app/ - Next.js je podle
// nazvu sam najde a vlozi do hlavicky, rucne se nic linkovat nemusi.
// Motiv vychazi z animovaneho loga Mediaspace, ktere je vlastne ekvalizer:
// tri zelene sloupce na fialovem podkladu. Zamerne jen tri a silne, aby to
// bylo poznat i v 16 px na zalozce.
export const metadata: Metadata = {
  title: 'MS Portal',
  description: 'Klientský portál Mediaspace',
  applicationName: 'MS Portal',
};

export const viewport = {
  themeColor: '#6B2AF0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${inter.variable} ${jost.variable} ${poppins.variable}`}>
      <head>
        {/* Svetly / tmavy rezim se musi nastavit JESTE PRED vykreslenim, jinak
            by pri kazdem nacteni blikla bila stranka. Proto obycejny skript
            v hlavicce, ne React - viz lib/motiv.ts. */}
        <script dangerouslySetInnerHTML={{ __html: SKRIPT_MOTIVU }} />
      </head>
      <body className="font-body">{children}</body>
    </html>
  );
}
