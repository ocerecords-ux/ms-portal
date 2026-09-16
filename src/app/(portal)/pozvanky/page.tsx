import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NovaPozvankaHerce } from '@/components/NovaPozvankaHerce';

/**
 * POZVÁNKY HERCŮ (zadání 16. 9. 2026: „tohle tlačítko musí mít zaple
 * Zuzo-labuzo i Helča — produkce").
 *
 * Celá administrace je vyhrazená Zuzo-labuzo a otevírat ji kvůli jednomu
 * tlačítku by znamenalo pustit Produkci ke kartám všech uživatelů. Tohle je
 * proto samostatná stránka jen s tím, co Produkce potřebuje: pozvat herce
 * a vidět, kdo se ještě nerozhoupal.
 */
export const dynamic = 'force-dynamic';

const SMI = ['ADMIN', 'PRODUKCE'];

export default async function PozvankyPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!SMI.includes(session.user.role)) redirect('/projekty');

  // Herci, kteří ještě nedošli do konce - pozvaní, ale bez hesla nebo bez údajů.
  const rozdelani = await prisma.user
    .findMany({
      where: {
        role: 'HEREC',
        active: true,
        OR: [{ passwordSetAt: null, invitedAt: { not: null } }, { udajeDoplneny: false }],
      },
      orderBy: { invitedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        invitedAt: true,
        passwordSetAt: true,
        udajeDoplneny: true,
      },
    })
    .catch(() => []);

  const dat = (d: Date | null) =>
    d ? d.toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : '—';

  return (
    <section className="flex flex-col gap-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink m-0">Pozvánky herců</h1>
          <p className="text-sm font-body text-muted m-0 mt-1">
            Pošlete herci e-mail a zbytek si vyplní sám — jméno, adresu, číslo účtu, kde může
            natáčet a jestli je plátce DPH.
          </p>
        </div>
        <NovaPozvankaHerce />
      </div>

      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-heading font-semibold text-ink m-0">Rozdělané pozvánky</h2>
          <p className="text-xs font-body text-muted m-0 mt-1">
            Kdo si ještě nenastavil heslo nebo nedoplnil údaje. Jakmile to dokončí, ze seznamu zmizí.
          </p>
        </div>

        {rozdelani.length === 0 ? (
          <p className="text-sm font-body text-muted m-0 px-5 py-6">
            Nic nevisí — všichni pozvaní herci jsou hotoví.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {rozdelani.map((h) => {
              const stav = !h.passwordSetAt ? 'Čeká na nastavení hesla' : 'Čeká na doplnění údajů';
              return (
                <li
                  key={h.id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-line last:border-0 flex-wrap"
                >
                  <span className="font-heading font-semibold text-ink flex-1 min-w-[180px]">
                    {h.name || h.email}
                    {h.name && <span className="block text-xs font-body text-muted">{h.email}</span>}
                  </span>
                  <span className="text-xs font-heading rounded-pill border border-line text-muted px-2.5 py-1">
                    {stav}
                  </span>
                  <span className="text-xs font-body text-muted w-24 text-right">
                    pozváno {dat(h.invitedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
