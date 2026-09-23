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

/** Studio bez klíče ho dostane při prvním otevření tabule. */
async function klicStudia(studio: { id: string; tabuleKlic: string | null }): Promise<string> {
  if (studio.tabuleKlic) return studio.tabuleKlic;
  const klic = novyKlicTabule();
  await prisma.studio.update({ where: { id: studio.id }, data: { tabuleKlic: klic } });
  return klic;
}

export default async function MojeTabule() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?callbackUrl=/tabule/moje');

  const ucet = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      tabuleStudio: { select: { id: true, name: true, tabuleKlic: true } },
      // Lidé z týmu, kteří mají tabuli povolenou (23. 9. 2026).
      tabulePristup: { select: { id: true, name: true, shortName: true, tabuleKlic: true } },
    },
  });

  /**
   * ČLOVĚK Z TÝMU (23. 9. 2026: „dej přístup na brněnské tabule Tomáši
   * Ilavskému a celému Žůžo-labůžo. A pak v Praze Ondřej Černý ml.").
   * Jedna tabule se otevře rovnou, u víc se nabídne, která.
   */
  if (session.user.role !== 'TABULE') {
    /**
     * ADMIN VIDÍ VŠECHNY TABULE (oprava 23. 9. 2026: „když kliknu na odkaz
     * tabule na hlavní liště, tam mě to přesměruje na projekty"). Admin nemá
     * proč mít sám sobě povolovat pobočky na kartě - vybere si tady.
     */
    const povolene =
      session.user.role === 'ADMIN'
        ? await prisma.studio.findMany({
            where: { active: true, parentStudioId: null },
            select: { id: true, name: true, tabuleKlic: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          })
        : ((ucet?.tabulePristup ?? []) as { id: string; name: string; tabuleKlic: string | null }[]);
    if (povolene.length === 0) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f0c17', color: '#f3f0fb', fontFamily: 'system-ui', padding: 24, textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: 32, margin: 0 }}>Tabule vám zatím nikdo nepovolil</h1>
            <p style={{ opacity: 0.7, fontSize: 18 }}>Napište Mediaspace, které studio chcete vidět - přístup se zapíná na kartě uživatele.</p>
            <p>
              <a href="/projekty" style={{ color: '#b9b2cc', fontSize: 16, textDecoration: 'underline' }}>
                ← Zpět do portálu
              </a>
            </p>
          </div>
        </main>
      );
    }
    if (povolene.length === 1) redirect(`/tabule/${await klicStudia(povolene[0])}`);
    const odkazy = await Promise.all(
      povolene.map(async (s) => ({ nazev: s.name, klic: await klicStudia(s) })),
    );
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f0c17', color: '#f3f0fb', fontFamily: 'system-ui', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Kterou tabuli otevřít?</h1>
          <p style={{ marginTop: 12 }}>
            <a href="/projekty" style={{ color: '#b9b2cc', fontSize: 16, textDecoration: 'underline' }}>
              ← Zpět do portálu
            </a>
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>
            {odkazy.map((o) => (
              <a
                key={o.klic}
                href={`/tabule/${o.klic}`}
                style={{
                  padding: '18px 28px',
                  borderRadius: 18,
                  border: '1px solid #3a3252',
                  background: '#191429',
                  color: '#f3f0fb',
                  textDecoration: 'none',
                  fontSize: 22,
                }}
              >
                {o.nazev}
              </a>
            ))}
          </div>
        </div>
      </main>
    );
  }

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
