import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { novyKlicTabule } from '@/lib/tabuleServer';

/**
 * TABULE PODLE PŘIHLÁŠENÍ (zadání 22. 9. 2026: „vytvořil bych pro každé
 * studio účet, kterým se přihlásím v Chromu na počítači, který bude napojený
 * na ten monitor. A tak identifikujeme, co tam má být").
 *
 * Účet s rolí Tabule ve studiu sem přijde hned po přihlášení a pošle se na
 * tabuli svého studia. Když studio tabuli ještě zapnutou nemá, zapne se.
 * Tabule sama pak běží přes svůj klíč, takže ji nezastaví ani vypršené
 * přihlášení - displej jede, dokud se v Administraci nevymění adresa.
 */
export const dynamic = 'force-dynamic';

export default async function MojeTabule() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?callbackUrl=/tabule/moje');
  if (session.user.role !== 'TABULE') redirect('/projekty');

  const ucet = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tabuleStudio: { select: { id: true, name: true, tabuleKlic: true } } },
  });
  const studio = ucet?.tabuleStudio;
  if (!studio) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f0c17', color: '#f3f0fb', fontFamily: 'system-ui', padding: 24, textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0 }}>Tabule nemá přiřazené studio</h1>
          <p style={{ opacity: 0.7, fontSize: 18 }}>V portálu otevřete Administrace → Studia a u studia vytvořte účet tabule.</p>
        </div>
      </main>
    );
  }

  let klic = studio.tabuleKlic;
  if (!klic) {
    klic = novyKlicTabule();
    await prisma.studio.update({ where: { id: studio.id }, data: { tabuleKlic: klic } });
  }
  redirect(`/tabule/${klic}`);
}
