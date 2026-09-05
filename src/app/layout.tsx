import type { Metadata } from 'next';
import { Inter, Jost, Poppins } from 'next/font/google';
import './globals.css';

// Nahrada za puvodni Wix fonty (Helvetica Neue / Futura / Avenir),
// viz README > Design system pro zduvodneni vyberu.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', weight: ['500', '600', '700', '800'] });
const jost = Jost({ subsets: ['latin', 'latin-ext'], variable: '--font-jost', weight: ['400', '500', '600'] });
const poppins = Poppins({ subsets: ['latin', 'latin-ext'], variable: '--font-poppins', weight: ['300', '400', '500', '600'] });

export const metadata: Metadata = {
  title: 'MS Portal',
  description: 'Klientský portál Mediaspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${inter.variable} ${jost.variable} ${poppins.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
