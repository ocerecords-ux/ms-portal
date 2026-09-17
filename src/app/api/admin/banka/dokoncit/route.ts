import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { smiDoBanky } from '@/lib/bankaPristup';
import { bankaNastavena, nactiSouhlas, nactiUcet } from '@/lib/gocardless';

/**
 * Doťuknutí po návratu z banky: portál se zeptá, jestli je souhlas potvrzený,
 * a doplní k napojení účet. Volá se ze stránky Banka po přesměrování zpátky.
 */
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  // Do banky smi jen ten, kdo to ma dovolene u uctu (17. 9. 2026).
  if (!(await smiDoBanky())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (!bankaNastavena()) return NextResponse.json({ error: 'Klíče GoCardless nejsou nastavené.' }, { status: 503 });

  const cekajici = await prisma.bankConnection.findMany({
    where: { OR: [{ stav: 'CEKA' }, { accountId: null }] },
    select: { id: true, requisitionId: true },
  });

  let hotovo = 0;
  for (const n of cekajici) {
    try {
      const souhlas = await nactiSouhlas(n.requisitionId);
      const accountId = souhlas.accounts[0];
      if (!accountId) continue;
      const ucet = await nactiUcet(accountId);
      await prisma.bankConnection.update({
        where: { id: n.id },
        data: {
          accountId,
          iban: ucet.iban ?? null,
          stav: 'AKTIVNI',
          lastSyncError: null,
        },
      });
      hotovo++;
    } catch (err) {
      console.error('Dotažení souhlasu selhalo:', err);
    }
  }

  return NextResponse.json({ hotovo });
}
