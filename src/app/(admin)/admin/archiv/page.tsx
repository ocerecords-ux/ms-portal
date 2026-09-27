import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { redirect } from 'next/navigation';
import { nactiJazyk } from '@/lib/jazykServer';
import { formatDatumCas, prelozit, prelozitS } from '@/lib/jazyk';

/**
 * Archiv smazaných záznamů (zadání 10. 9. 2026).
 *
 * Když se firma, účet nebo projekt maže i s tím, co na něm viselo, uloží se
 * všechno sem jako JSON. Je to poslední záchrana, ne provozní nástroj -
 * proto tu není hledání ani stránkování, jen seznam a stahování.
 */
export const dynamic = 'force-dynamic';

/**
 * Popisky druhů archivu se berou ze slovníku, ne z POPISKY_DRUHU_ARCHIVU
 * (lib/archiv.ts) - ten je česky a chodí i do e-mailů a JSON souborů, kde
 * jazyk neurčuje přepínač v liště.
 */
const KLICE_DRUHU: Record<string, string> = {
  FIRMA: 'archiv.druh.firma',
  UZIVATEL: 'archiv.druh.uzivatel',
  PROJEKT: 'archiv.druh.projekt',
  KALENDAR: 'archiv.druh.kalendar',
};

export default async function ArchivPage() {
  const jazyk = nactiJazyk();
  const session = await requireAdmin();
  if (!session) redirect('/');

  const zaznamy = await prisma.archiv.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      druh: true,
      nazev: true,
      souhrn: true,
      pocetZaznamu: true,
      uzivatelJmeno: true,
      createdAt: true,
    },
  });

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">{prelozit(jazyk, 'archiv.nadpis')}</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[720px]">{prelozit(jazyk, 'archiv.uvod')}</p>
      </div>

      {zaznamy.length === 0 ? (
        <div className="bg-surface rounded-card border border-line shadow-sm p-6">
          <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'archiv.prazdno')}</p>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-field text-ink font-heading text-xs">
                  <th className="text-left px-4 py-3 whitespace-nowrap">{prelozit(jazyk, 'archiv.sl.kdy')}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{prelozit(jazyk, 'archiv.sl.co')}</th>
                  <th className="text-left px-4 py-3">{prelozit(jazyk, 'archiv.sl.nazev')}</th>
                  <th className="text-left px-4 py-3">{prelozit(jazyk, 'archiv.sl.obsah')}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{prelozit(jazyk, 'archiv.sl.kdo')}</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">{prelozit(jazyk, 'archiv.sl.soubor')}</th>
                </tr>
              </thead>
              <tbody>
                {zaznamy.map((z) => (
                  <tr key={z.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                      {formatDatumCas(jazyk, z.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-heading whitespace-nowrap">
                      {prelozit(jazyk, KLICE_DRUHU[z.druh] ?? 'archiv.druh.jine')}
                    </td>
                    <td className="px-4 py-3 text-sm font-heading font-semibold text-ink max-w-[260px] break-words">
                      {z.nazev}
                    </td>
                    <td className="px-4 py-3 text-sm font-body text-muted max-w-[320px] break-words">
                      {z.souhrn}
                      <span className="block text-xs tabular-nums mt-0.5">
                        {prelozitS(jazyk, 'archiv.pocetZaznamu', { pocet: z.pocetZaznamu })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-heading text-muted whitespace-nowrap">
                      {z.uzivatelJmeno || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/api/admin/archiv/${z.id}`}
                        prefetch={false}
                        className="text-brand-purple font-heading font-semibold text-sm no-underline hover:underline"
                      >
                        {prelozit(jazyk, 'archiv.stahnout')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
