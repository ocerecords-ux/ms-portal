import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { odpovedChyby } from '@/lib/chybyApi';
import { prisma } from '@/lib/db';
import { uploadExpenseAttachment } from '@/lib/storage';

/**
 * FAKTURA OD ZVUKAŘE (zadání 20. 11. 2026: „potřebuju, aby mohli fakturu
 * vkládat zvukaři tam, kde mají výkazy. Aby tam prostě jen nahráli soubor
 * a nám to pak v dokladech vyskočilo v nezařazených dokladech").
 *
 * Vznikne NEZAŘAZENÝ výdaj - úplně stejný druh záznamu, jaký dělá čtení
 * účtárenské schránky. Účetní ho v Dokladech překontroluje, doplní částku
 * a kategorii a tím se zařadí. Nic se tu nepočítá a nic se neschvaluje:
 * portál jen přijme soubor a založí doklad.
 *
 * SMÍ TO TEN, KDO SI PÍŠE VÝKAZY - zvukař a kdo má na kartě `takyZvukar`.
 * Totéž pravidlo jako u psaní výkazu samotného.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function smiVkladat(userId: string, role: string | undefined) {
  if (role === 'ZVUKAR') return true;
  const ucet = await prisma.user
    .findUnique({ where: { id: userId }, select: { takyZvukar: true } })
    .catch(() => null);
  return Boolean(ucet?.takyZvukar);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return odpovedChyby('chybaApi.bezOpravneni', 403);
  if (!(await smiVkladat(session.user.id, session.user.role))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const formular = await req.formData().catch(() => null);
  const soubor = formular?.get('soubor');
  if (!(soubor instanceof File) || soubor.size === 0) {
    return odpovedChyby('chybaApi.neplatnaData', 400);
  }

  const ulozeno = await uploadExpenseAttachment(soubor);
  if (!ulozeno || 'error' in ulozeno) {
    return NextResponse.json(
      { error: ulozeno && 'error' in ulozeno ? ulozeno.error : 'Soubor se nepodařilo uložit.' },
      { status: 400 },
    );
  }

  const jmeno = session.user.name || session.user.email || 'zvukař';
  const poznamka = String(formular?.get('poznamka') ?? '').trim().slice(0, 300);

  await prisma.expense.create({
    data: {
      stav: 'NEZARAZENY',
      zdroj: 'VYKAZ',
      // Nez to ucetni otevre, at je v seznamu poznat, od koho to je.
      // NÁZEV JE JMÉNO ZVUKAŘE (20. 11. 2026: „název dokladu by měl být podle
      // jména zvukaře. Tzn. jen Richard Hanula"). V seznamu dokladů je pak
      // hned vidět, čí faktura to je - slovo „Faktura" tam nic nepřidává.
      description: jmeno,
      supplierName: jmeno,
      issueDate: new Date(),
      paid: false,
      attachmentUrl: ulozeno.url,
      attachmentName: ulozeno.name,
      note: poznamka || null,
      nahralId: session.user.id,
      nahralJmeno: jmeno,
    },
  });

  return NextResponse.json({ ok: true });
}
