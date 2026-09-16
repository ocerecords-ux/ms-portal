import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SeznamNavodu } from './SeznamNavodu';

/**
 * NÁPOVĚDA — přehled návodů (zadání 16. 9. 2026: „přemýšlím, že by tyhle
 * manuály mohly být někde dostupné v portálu, aby se k nim všichni dostali.
 * Udělejme nějakou přehlednou sekci a tam budeme vše postupně přidávat.
 * I s nějakým fulltext hledáním").
 *
 * VŠECHNY NÁVODY SE POŠLOU NAJEDNOU a hledá se v prohlížeči. Je jich řádově
 * desítky, ne tisíce — a hledání, které odpovídá při psaní, je k nezaplacení
 * oproti tomu, které se na každé písmeno ptá serveru.
 *
 * Rozepsaný návod (nezveřejněný) vidí jen Zuzo-labuzo; ostatní ho v seznamu
 * nemají vůbec, ne šedě.
 */
export const dynamic = 'force-dynamic';

export default async function NapovedaPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const role = session.user.role;
  const jeAdmin = role === 'ADMIN';

  const navody = await prisma.navod
    .findMany({
      where: jeAdmin ? {} : { zverejneno: true },
      orderBy: [{ kategorie: 'asc' }, { poradi: 'asc' }, { nazev: 'asc' }],
      select: {
        id: true,
        slug: true,
        nazev: true,
        perex: true,
        kategorie: true,
        hledaci: true,
        obsah: true,
        zverejneno: true,
        proRole: true,
        updatedAt: true,
      },
    })
    .catch(() => []);

  // Návod psaný pro produkci nemá co dělat v seznamu herce.
  const moje = navody.filter((n) => n.proRole.length === 0 || n.proRole.includes(role));

  return (
    <SeznamNavodu
      jeAdmin={jeAdmin}
      navody={moje.map((n) => ({
        id: n.id,
        slug: n.slug,
        nazev: n.nazev,
        perex: n.perex,
        kategorie: n.kategorie,
        hledaci: n.hledaci,
        obsah: n.obsah,
        zverejneno: n.zverejneno,
        upraveno: n.updatedAt.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }),
      }))}
    />
  );
}
