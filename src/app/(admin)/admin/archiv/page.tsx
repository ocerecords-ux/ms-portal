import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { redirect } from 'next/navigation';
import { POPISKY_DRUHU_ARCHIVU } from '@/lib/archiv';
import { formatujCas } from '@/lib/projektLog';

/**
 * Archiv smazaných záznamů (zadání 10. 9. 2026).
 *
 * Když se firma, účet nebo projekt maže i s tím, co na něm viselo, uloží se
 * všechno sem jako JSON. Je to poslední záchrana, ne provozní nástroj -
 * proto tu není hledání ani stránkování, jen seznam a stahování.
 */
export const dynamic = 'force-dynamic';

export default async function ArchivPage() {
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
        <h1 className="font-display text-3xl text-ink m-0">Archiv</h1>
        <p className="text-sm font-body text-muted m-0 mt-2 max-w-[720px]">
          Co se uložilo stranou, než se firma, účet nebo projekt smazal i s navázanými věcmi.
          Stažený soubor je JSON — kompletní data tak, jak byla v databázi. Portál je zpátky
          nenačte, ale dá se z nich vyčíst, co tam bylo.
        </p>
      </div>

      {zaznamy.length === 0 ? (
        <div className="bg-surface rounded-card border border-line shadow-sm p-6">
          <p className="text-sm font-body text-muted m-0">
            Archiv je prázdný — zatím se nic nemazalo s navázanými věcmi.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-field text-ink font-heading text-xs">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Kdy</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Co</th>
                  <th className="text-left px-4 py-3">Název</th>
                  <th className="text-left px-4 py-3">Obsah</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Kdo</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Soubor</th>
                </tr>
              </thead>
              <tbody>
                {zaznamy.map((z) => (
                  <tr key={z.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                      {formatujCas(z.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-heading whitespace-nowrap">
                      {POPISKY_DRUHU_ARCHIVU[z.druh]}
                    </td>
                    <td className="px-4 py-3 text-sm font-heading font-semibold text-ink max-w-[260px] break-words">
                      {z.nazev}
                    </td>
                    <td className="px-4 py-3 text-sm font-body text-muted max-w-[320px] break-words">
                      {z.souhrn}
                      <span className="block text-xs tabular-nums mt-0.5">
                        {z.pocetZaznamu} záznamů
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
                        Stáhnout ↓
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
