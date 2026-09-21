import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { nactiTabuli, studioPodleKlice } from '@/lib/tabuleServer';
import { Tabule } from './Tabule';

/**
 * TABULE VE STUDIU (zadání 21. 9. 2026) - stránka pro dotykový displej ve
 * studiu. Bez přihlášení; adresa s tajným klíčem se bere v Administraci →
 * Studia. Návrh: artefakt „Tabule ve studiích".
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Tabule studia', robots: { index: false, follow: false } };

export default async function TabulePage({ params }: { params: { klic: string } }) {
  const studio = await studioPodleKlice(params.klic);
  if (!studio) notFound();
  const data = await nactiTabuli(studio);
  return <Tabule klic={params.klic} pocatecni={data} />;
}
